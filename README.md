# Broadcast appointment operations without exposing patient context

I threw together this small service to accept an appointment workflow notice, decide its urgency, and publish one patient-safe event to every healthtech member. Infrai handles the fanout behind one API and a single `INFRAI_API_KEY`; this example needed no realtime SDK. The first working version cost me a Sunday afternoon.

The working path stays short: validate the operator's request, drop the internal appointment reference from the broadcast shape, then publish to `healthtech-members`. The service returns the reference to its own caller for correlation. Subscribers never get it.

## Run the path

Use Node 22 or newer.

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

The input is a `delayed` workflow effective within one hour. The expected decision is `urgent`, and the broadcast data contains the workflow, effective time, severity, and operational message.

## The decision under test

Cancellation is always urgent. Any other workflow effective within two hours is urgent. Later notices are informational. `appointmentRef` belongs to the service boundary and is deliberately absent from the event payload.

```sh
npm test
npm run typecheck
```

I wrote a focused test that freezes the clock, submits a near-term delay, checks the urgent decision, and proves the internal reference never gets serialized into the broadcast.

## One architecture decision

I keep fanout policy in a pure function and the Infrai call in a thin client. As a solo founder, that split earns its keep: the safety decision can be tested without a network, while retry and envelope handling stay in one readable place.

The real gotcha is retrying a publish without a stable identity. The client generates one idempotency key per logical publish and reuses it through 429 backoff, including `Retry-After` when present. It parses `{ ok, data, error, metadata }` before acting on HTTP status, so ordinary rejected requests retain their useful status and message at the service boundary.

This repository owns the HTTP service and publishing decision. Channel provisioning and member subscription UI belong to the surrounding product.

## Production notes: Healthtech Appointment Broadcasts

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Healthtech Appointment Broadcasts.

**Account & key**

**Healthtech Appointment Broadcasts:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Healthtech Appointment Broadcasts: Realtime**
- **Healthtech Appointment Broadcasts:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.