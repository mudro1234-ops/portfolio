# Madrude GPS hardware procurement — Zimbabwe pilot

## Sourcing shortlist

These are suppliers to request quotations from, not pre-approved purchase orders. Confirm stock, exact model variant, LTE bands, warranty, delivery to Zimbabwe, customs and return terms in writing.

### Zimbabwe installation and sourcing enquiries

- Kukhulani Technologies / Kukhutech — 25 Downie Ave, Harare; +263 78 412 5741. Ask whether they can supply unlocked 4G Teltonika FMC920/FMC150 units and provide a bulk quote.
- Ztrack Zimbabwe — 66 Fifth Street, Harare; +263 78 841 6351. Ask for a sample unit, exact model and protocol.
- O'Track Global — 51 Van Praagh Ave, Harare; +263 77 999 9600. Ask for hardware-only and installation-only quotations separately.
- eTrack Zimbabwe — Travel Plaza, 29 Mazowe Street, Harare; +263 8644 273685. Ask whether they will supply hardware configured to a customer-owned Traccar server.
- iTrack Zimbabwe — Shop 155, Longcheng Plaza, Harare; +263 24 2485546. Ask about CAN-compatible units and device protocol documentation.

These are local leads for quotation and installation discussions. Their listing does not establish that they sell unlocked hardware or support third-party Traccar servers.

### Regional and direct hardware channels

- GotYou Telematics (South Africa): https://www.gotyou.co.za/teltonika — advertises itself as an authorised Teltonika distributor in Southern Africa, lists FMC920/FMC150, and states it supports Traccar configuration. Request a Zimbabwe-delivered pro-forma invoice and confirm warranty/returns.
- GPS Track (South Africa): https://gpstrack.co.za/hardware/ — publishes indicative retail prices including FMC920 at R999, FMC150 at R1,699 and installation from R550 within South Africa. These are not Zimbabwe delivered prices.
- DistriNode (South Africa): https://distrinode.co.za/teltonika — B2B Teltonika supply channel; request reseller pricing and warranty proof.
- WorldLink Security Systems (Tanzania): https://www.worldlinksecurity.co.tz/shop/product/teltonika-fmc920-4g-gps-vehicle-tracker/ — lists FMC920 and offers installation enquiries; ask for Zimbabwe export pricing and exact SKU/bands.
- Concox/Jimi: use a verifiable official distributor channel and request the exact 4G model, firmware, protocol and warranty. Do not buy generic "Concox compatible" units without a bench test.

## First pilot purchase

Do not order 50 units initially. Purchase 3–5 sample trackers from at least two suppliers:
- 2 x Teltonika FMC920 (exact LTE variant selected after band confirmation)
- 1 x Teltonika FMC150 or another hardwired 4G model with required inputs
- 1–2 x alternative 4G model only if its exact protocol is supported by the deployed Traccar version

Test on at least two Zimbabwean mobile networks and in the actual operating areas. Expand to 10–15 devices only after the tests pass.

## Mandatory supplier questionnaire

1. Exact manufacturer, model, SKU and LTE band list for the unit supplied?
2. Is it unlocked and usable with customer-owned Econet, NetOne or other SIMs?
3. Does the exact hardware/firmware protocol appear in the current Traccar supported-device list?
4. Can you provide the protocol name, configuration guide and a sample device?
5. Does it support 4G LTE Cat 1 (or better), GNSS, ignition input and backup battery?
6. Warranty length, DOA replacement period, RMA address and who pays return freight?
7. Unit price at quantities 5, 10, 25 and 50; installation price; shipping, customs and taxes to Zimbabwe?
8. Can you configure the device to send directly to a customer-owned Traccar server without a vendor cloud subscription?
9. Can you supply firmware updates and confirm whether configuration is password-protected?
10. Can you provide references for Zimbabwe/SADC deployments?

Reject suppliers who will not disclose the exact SKU, bands, protocol or warranty terms.

## Technical acceptance checklist

### Radio and SIM
- Verify the exact modem SKU and LTE bands against the operator's current published/confirmed bands in the intended routes.
- Confirm APN, SIM PIN status, roaming restrictions, data bundle validity and whether the SIM supports machine-to-machine use.
- Test the SIM in the device, not just in a phone.
- Record operator, SIM MSISDN and ICCID in Madrude; restrict access to SIM identifiers to authorised fleet administrators.
- Do not assume "4G" guarantees Zimbabwe coverage. Test route-level signal and handover.

### GPS and vehicle installation
- Confirm GNSS fix outdoors and compare positions against a known reference.
- Verify 12/24V input range, fuse, ground, ignition sensing and sleep behaviour.
- Test backup battery reporting after vehicle power is disconnected.
- Confirm tamper-resistant installation and no interference with airbags or vehicle electronics.
- Obtain vehicle-owner permission and document the installation.

### Traccar compatibility
- Confirm exact model/protocol against the current Traccar supported devices list.
- Register device using IMEI/unique ID and map its Traccar numeric device ID to Madrude's gps_devices.provider_device_id.
- Verify correct coordinates, timestamp, speed, heading and ignition attributes.
- Test duplicate packets, out-of-order packets, no-network recovery and server restart.
- Confirm data is delivered to Madrude's authenticated webhook and tenant/vehicle linkage is correct.

### Pilot pass criteria
- At least 72 hours of stable reporting across urban and longer routes.
- No unexplained gaps longer than 5 minutes while moving, except documented network dead zones.
- GPS positions and trip distances compared with a known route.
- Actual SIM MB consumption measured over 7 days and projected monthly.
- Reconnection after coverage loss without manual intervention.
- Stale/offline state correctly shown in Madrude.

## SIM strategy

Start with customer-owned local SIMs and support any operator whose SIM and LTE coverage passes the pilot. Negotiate pooled business/M2M data only after measured consumption is known. The initial 50–100 MB/month figure is a planning allowance, not a promise; actual use depends on interval, protocol overhead, coverage and retries. Record consumption per SIM where the operator portal supports it.

For drivers using the smartphone app, use the driver's existing data initially. Do not silently track; consent must be explicit and revocable.

## Commercial model

Offer two hardware paths:
- Customer-owned hardware: customer buys and maintains the compatible tracker; Madrude charges software subscription.
- Madrude-supplied hardware: one-time hardware + installation charge, or a lease with deposit and monthly device fee. Keep the hardware lease separate from the software subscription.

Indicative software prices for testing willingness to pay (not yet validated against operating costs):
- Essential: US$5/vehicle/month, customer supplies SIM/data.
- Fleet: US$7.50/vehicle/month.
- Enterprise: US$10–12/vehicle/month.
- Smartphone-only: US$3.50/active driver/month, driver/employer supplies data.

Before publishing prices, calculate server, support, payment, taxes, SIM and replacement costs. Do not bundle unlimited data or promise 24/7 support without a costed service level.
