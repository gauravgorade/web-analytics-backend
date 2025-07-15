export function errorResponse(message: string, data: any = null) {
  return {
    success: false,
    message,
    ...((data !== null && typeof data === "object") ? { data } : {}),
  };
}

export function successResponse(message: string, data: any = null) {
  return {
    success: true,
    message,
    ...((data !== null && typeof data === "object") ? { data } : {}),
  };
}
