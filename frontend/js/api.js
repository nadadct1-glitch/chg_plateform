/**
 * Petit client HTTP pour parler à l'API FastAPI (/api/*).
 * Le frontend et l'API sont servis par le même serveur : les chemins
 * relatifs "/api/..." suffisent, aucune configuration d'URL n'est requise.
 */
const TOKEN_KEY = "chg_token";

const Api = {
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },
  setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  },
  clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  },
  isLoggedIn() {
    return !!this.getToken();
  },

  async _request(method, path, body) {
    const headers = { "Content-Type": "application/json" };
    const token = this.getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;

    let response;
    try {
      response = await fetch(path, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (networkErr) {
      throw new ApiError("Impossible de contacter le serveur. Vérifiez votre connexion.", 0);
    }

    if (response.status === 401) {
      this.clearToken();
      const onPublicPage = ["/", "/index.html", "/login.html", "/rejoindre.html"].includes(
        window.location.pathname
      );
      if (!onPublicPage) {
        window.location.href = "/login.html";
      }
      throw new ApiError("Session expirée, merci de vous reconnecter.", 401);
    }

    if (response.status === 204) return null;

    let data = null;
    const text = await response.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!response.ok) {
      const detail = (data && data.detail) || `Erreur ${response.status}`;
      throw new ApiError(typeof detail === "string" ? detail : JSON.stringify(detail), response.status);
    }
    return data;
  },

  get(path) {
    return this._request("GET", path);
  },
  post(path, body) {
    return this._request("POST", path, body ?? {});
  },
  patch(path, body) {
    return this._request("PATCH", path, body ?? {});
  },
  delete(path) {
    return this._request("DELETE", path);
  },
};

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// ---------------------------------------------------------------------
// Petites notifications ("toasts") réutilisées sur toutes les pages
// ---------------------------------------------------------------------
function toast(message, type = "info") {
  let wrap = document.querySelector(".toast-wrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = "toast-wrap";
    document.body.appendChild(wrap);
  }
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

function apiErrorMessage(err) {
  return err instanceof ApiError ? err.message : "Une erreur inattendue s'est produite.";
}
