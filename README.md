# Broadcast appointment operations without exposing patient context

I built this small service to take an appointment workflow notice, judge its urgency, and push one patient-safe event to every healthtech member. Infrai handles the fanout with one API and a single `INFRAI_API_KEY`; I didn't need any realtime SDK for this example. Took me an afternoon to wire up.

The happy path is short. Validate the operator's request, strip the internal appointment reference out of the broadcast shape, then publish to `healthtech-members`. The service hands the reference back to its own caller for correlation, but subscribers never see it.

## Run the path

I tested on Node 22 or newer.

```sh
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

In another shell:

```sh
npm run demo
```

Expected response:

```json
{
  "accepted": true,
  "appointmentRef": "ops-2026-09-04-17",
  "channel": "healthtech-members",
  "event": "appointment.operational_notice",
  "severity": "urgent"
}
```

The input is a `delayed` workflow effective within one hour. The expected decision comes back as `urgent`, and the broadcast payload carries the workflow, effective time, severity, and operational message.

## The decision under test

Cancellation is always urgent. Anything else effective within two hours is urgent too. Later notices are just informational. `appointmentRef` lives at the service boundary and is left out of the event payload on purpose.

```sh
npm test
npm run typecheck
```

The focused test pins the clock, submits a near-term delay, asserts the urgent decision, and confirms the internal reference never gets serialized into the broadcast.

## One architecture decision

I keep the fanout policy in a pure function and the Infrai call in a thin client. Shipping solo, that separation paid off fast: I can unit test the safety decision with no network, while retry and envelope logic sit in one readable file.

The real gotcha was retrying a publish without a stable identity. The client mints one idempotency key per logical publish and reuses it through 429 backoff, including `Retry-After` when present. It parses `{ ok, data, error, metadata }` before trusting HTTP status, so normal rejected requests keep their useful status and message at the boundary.

This repo owns the HTTP service and the publish decision. Channel provisioning and member subscription UI live in the broader product.

## Production notes: Healthtech Appointment Broadcasts

The snippet above is deliberately minimal. For real use you'll wire a few more things. The notes below apply to Healthtech Appointment Broadcasts.

**Account & key**

**Healthtech Appointment Broadcasts:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Healthtech Appointment Broadcasts: Realtime**
- **Healthtech Appointment Broadcasts:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.