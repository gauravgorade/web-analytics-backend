(function () {
  const scriptTag = document.currentScript;
  const SITE_PUBLIC_KEY = scriptTag?.getAttribute("site-key");
  if (!SITE_PUBLIC_KEY) return console.warn("Web Analytics: Missing site-key attribute.");

  const BASE_URL = new URL(scriptTag.src).origin;
  const COLLECT_URL = BASE_URL + "/collect";
  const EVENT_URL = BASE_URL + "/event";

  const VISITOR_ID_KEY = "_wa_visitor_id";
  const SESSION_ID_KEY = "_wa_session_id";
  const LAST_ACTIVITY_KEY = "_wa_last_activity";
  const SESSION_TIMEOUT_MINUTES = 5;
  const timeoutDuration = SESSION_TIMEOUT_MINUTES * 60 * 1000;

  const now = () => Date.now();

  function getOrCreateVisitorId() {
    let visitorId = localStorage.getItem(VISITOR_ID_KEY);
    if (!visitorId) {
      visitorId = crypto.randomUUID();
      localStorage.setItem(VISITOR_ID_KEY, visitorId);
    }
    return visitorId;
  }

  function hasSessionExpired() {
    const last = parseInt(localStorage.getItem(LAST_ACTIVITY_KEY) || "0", 10);
    return now() - last > timeoutDuration;
  }

  function createNewSession() {
    const newId = crypto.randomUUID();
    localStorage.setItem(SESSION_ID_KEY, newId);
    localStorage.setItem(LAST_ACTIVITY_KEY, now().toString());
    return newId;
  }

  function getOrCreateSession() {
    const existingId = localStorage.getItem(SESSION_ID_KEY);
    if (!existingId || hasSessionExpired()) {
      return createNewSession();
    } else {
      localStorage.setItem(LAST_ACTIVITY_KEY, now().toString());
      return existingId;
    }
  }

  let visitorId = getOrCreateVisitorId();
  let sessionId = getOrCreateSession();

  function updateActivity() {
    localStorage.setItem(LAST_ACTIVITY_KEY, now().toString());
    resetInactivityTimer();
  }

  let inactivityTimer = null;
  function resetInactivityTimer() {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
      localStorage.removeItem(SESSION_ID_KEY);
      localStorage.removeItem(LAST_ACTIVITY_KEY);
      sessionId = createNewSession();
    }, timeoutDuration);
  }

  ["click", "scroll", "keydown", "mousemove", "visibilitychange"].forEach((event) => {
    window.addEventListener(event, updateActivity);
  });

  resetInactivityTimer();

  const baseData = {
    site_public_key: SITE_PUBLIC_KEY,
    visitor_id: visitorId,
    session_id: sessionId,
    user_agent: navigator.userAgent,
    device_type: (() => {
      const width = window.innerWidth;
      if (width <= 768) return "mobile";
      if (width <= 1024) return "tablet";
      return "desktop";
    })(),
  };

  function collect() {
    const payload = {
      ...baseData,
      url: location.href,
      referrer: document.referrer,
    };

    fetch(COLLECT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }

  let lastUrl = location.pathname + location.search;

  const observeRouteChanges = () => {
    const newUrl = location.pathname + location.search;
    if (newUrl !== lastUrl) {
      lastUrl = newUrl;
      collect();
    }
  };

  const originalPushState = history.pushState;
  history.pushState = function () {
    originalPushState.apply(this, arguments);
    setTimeout(observeRouteChanges, 0);
  };

  window.addEventListener("popstate", observeRouteChanges);

  function sendEvent(name, data = {}) {
    const payload = {
      site_public_key: SITE_PUBLIC_KEY,
      visitor_id: visitorId,
      session_id: sessionId,
      name,
      event_data: data,
    };

    fetch(EVENT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }

  collect();

  window.PUTLERWA = {
    event: sendEvent,
  };
})();
