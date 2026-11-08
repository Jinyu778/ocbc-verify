# `make dev` runs everything without Docker. On Windows without make, use the npm scripts
# shown on the right (in PowerShell use `npm.cmd` if script execution is disabled).
.PHONY: install dev reset-data test backend-test web-test e2e

install:            ## first-time setup
	cd backend && python -m venv .venv && (.venv/bin/pip install -r requirements.txt || .venv\Scripts\pip install -r requirements.txt)
	npm install

dev:                ## npm run dev  -> API :8000 + app :5173
	npm run dev

reset-data:         ## npm run reset-data  -> wipe and re-seed the test accounts
	npm run reset-data

test: backend-test web-test e2e

backend-test:
	npm run test:backend

web-test:
	npm run test:web

e2e:
	npm run test:e2e
