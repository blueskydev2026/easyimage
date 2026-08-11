from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse
import mimetypes
import sys


IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".avif"}


class PhotoManagerHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/local-image":
            self.serve_local_image(parsed.query)
            return
        super().do_GET()

    def serve_local_image(self, query):
        path_value = parse_qs(query).get("path", [""])[0]
        try:
            image_path = Path(unquote(path_value)).resolve()
            if image_path.suffix.lower() not in IMAGE_EXTENSIONS or not image_path.is_file():
                raise FileNotFoundError()
            content_type = mimetypes.guess_type(str(image_path))[0] or "application/octet-stream"
            data = image_path.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except Exception:
            self.send_error(404, "Image not found")


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8794
    server = ThreadingHTTPServer(("127.0.0.1", port), PhotoManagerHandler)
    server.serve_forever()


if __name__ == "__main__":
    main()
