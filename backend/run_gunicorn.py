#!/usr/bin/env python3
"""
Gunicorn launcher that runs gevent monkey patching before any other imports.

Use this as the process entrypoint (e.g. in Docker/Peach) to avoid
MonkeyPatchWarning about ssl/urllib3 being imported before patching.
The gunicorn CLI imports modules before loading gunicorn.conf.py, so
patch_all() in the config can run too late in some environments.
"""
from gevent import monkey

monkey.patch_all()

import sys

# Run gunicorn with our config and app (run() reads sys.argv)
sys.argv = ["gunicorn", "--config", "gunicorn.conf.py", "wsgi:app"]

from gunicorn.app.wsgiapp import run

if __name__ == "__main__":
    run()
