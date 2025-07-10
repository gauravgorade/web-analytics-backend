(function () {
  const scriptTag = document.currentScript;
  const SITE_PUBLIC_KEY = scriptTag?.getAttribute("site-key");
  if (!SITE_PUBLIC_KEY) return console.warn("PUTLERWA Analytics: Missing site-key attribute.");

  const BASE_URL = new URL(scriptTag.src).origin;
  const COLLECT_URL = BASE_URL + "/collect";
  const EVENT_URL = BASE_URL + "/event";

  const sessionId = (() => {
    const key = "_putlerwa_session_id";
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    return id;
  })();

  const baseData = {
    site_public_key: SITE_PUBLIC_KEY,
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
