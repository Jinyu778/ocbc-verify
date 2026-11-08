# `make dev` runs everything without Docker. On Windows without make, use `npm run dev` (same thing).
.PHONY: install dev test backend-test web-test e2e reset

install:
	cd backend && python -m venv .venv && .venv/bin/pip install -r requirements.txt || .venv\Scripts\pip install -r requirements.txt
	npm install

dev:
	npm run dev

test: backend-test web-test e2e

backend-test:
	npm run test:backend

web-test:
	npm run test:web

e2e:
	npm run test:e2e

reset:
	npm run reset
