from __future__ import annotations

import argparse
import json
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlencode, urlparse

ROLE_IDENTITIES = {
    "operator": ("e2e-operator", "运营小甘"),
    "supervisor": ("e2e-supervisor", "运营主管李青"),
    "procurement": ("e2e-procurement", "采购计划周宁"),
    "unmapped": ("e2e-unmapped", "未映射用户"),
}


class DingTalkStubHandler(BaseHTTPRequestHandler):
    selected_role = "operator"

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        query = parse_qs(parsed.query)
        if parsed.path == "/select":
            role = query.get("role", [""])[0]
            if role not in ROLE_IDENTITIES:
                self._json(HTTPStatus.BAD_REQUEST, {"error": "invalid_role"})
                return
            type(self).selected_role = role
            self._json(HTTPStatus.OK, {"selected_role": role})
            return
        if parsed.path == "/oauth2/auth":
            redirect_uri = query.get("redirect_uri", [""])[0]
            state = query.get("state", [""])[0]
            if not redirect_uri or not state:
                self._json(HTTPStatus.BAD_REQUEST, {"error": "invalid_request"})
                return
            callback_query = urlencode({"code": self.selected_role, "state": state})
            self.send_response(HTTPStatus.FOUND)
            self.send_header("Location", f"{redirect_uri}?{callback_query}")
            self.end_headers()
            return
        if parsed.path == "/v1.0/contact/users/me":
            access_token = self.headers.get("x-acs-dingtalk-access-token", "")
            role = access_token.removeprefix("token-")
            identity = ROLE_IDENTITIES.get(role)
            if identity is None:
                self._json(HTTPStatus.UNAUTHORIZED, {"error": "invalid_token"})
                return
            actor_ref, actor_name = identity
            self._json(HTTPStatus.OK, {"unionId": actor_ref, "nick": actor_name})
            return
        self._json(HTTPStatus.NOT_FOUND, {"error": "not_found"})

    def do_POST(self) -> None:  # noqa: N802
        if urlparse(self.path).path != "/v1.0/oauth2/userAccessToken":
            self._json(HTTPStatus.NOT_FOUND, {"error": "not_found"})
            return
        length = int(self.headers.get("Content-Length", "0"))
        try:
            payload = json.loads(self.rfile.read(length))
        except (json.JSONDecodeError, UnicodeDecodeError):
            self._json(HTTPStatus.BAD_REQUEST, {"error": "invalid_json"})
            return
        code = payload.get("code")
        if code not in ROLE_IDENTITIES:
            self._json(HTTPStatus.BAD_REQUEST, {"error": "invalid_code"})
            return
        self._json(HTTPStatus.OK, {"accessToken": f"token-{code}"})

    def log_message(self, format: str, *args: object) -> None:
        return

    def _json(self, status_code: HTTPStatus, payload: dict[str, str]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main() -> None:
    parser = argparse.ArgumentParser(description="本地钉钉 OAuth 协议 E2E 服务")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", default=8765, type=int)
    args = parser.parse_args()
    server = ThreadingHTTPServer((args.host, args.port), DingTalkStubHandler)
    server.serve_forever()


if __name__ == "__main__":
    main()
