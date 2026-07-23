#!/usr/bin/env python3
"""Local dev server with Netlify-style clean URLs (/about -> about.html).
The production redirects live in _redirects; this just mirrors the serving
behavior so internal links work in the local preview too."""
import http.server, os

class CleanURLHandler(http.server.SimpleHTTPRequestHandler):
    def send_head(self):
        path = self.path.split("?", 1)[0].split("#", 1)[0]
        if path != "/" and "." not in os.path.basename(path):
            candidate = path.lstrip("/") + ".html"
            if os.path.isfile(candidate):
                query = self.path[len(path):]
                self.path = "/" + candidate + query
        return super().send_head()

if __name__ == "__main__":
    http.server.ThreadingHTTPServer(("", 4173), CleanURLHandler).serve_forever()
