function normalizeUrl(url) {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export function getServerUrl() {
  const configured = import.meta.env.VITE_SERVER_URL;
  if (configured) {
    return normalizeUrl(configured);
  }

  if (typeof window === "undefined") {
    return "http://localhost:8000";
  }

  const { protocol, hostname, port } = window.location;
  const isHttps = protocol === "https:";
  const currentPort = Number(port || (isHttps ? "443" : "80"));
  const targetPort = isHttps ? currentPort : currentPort + 1;
  const targetProtocol = isHttps ? "https:" : "http:";

  return `${targetProtocol}//${hostname}:${targetPort}`;
}
