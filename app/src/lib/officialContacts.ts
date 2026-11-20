/**
 * The app's built-in "call back" directory. Zero trust: whoever contacted the customer, the app
 * never dials a number that came from a caller or a message, only these.
 *
 * Checked against official sources on 2026-11-20. Re-check before any demo; numbers and menu
 * options can change.
 *  - OCBC Personal Banking 24-hour hotline 6363 3333, press 8 to report fraud
 *    (ocbc.com/personal-banking/security/need-help; one OCBC page says press 9)
 *  - ScamShield Helpline 1799, 24 hours (scamshield.gov.sg/scamshield-helpline)
 *  - Police Hotline 1800 255 0000; 999 in an emergency (police.gov.sg)
 */
export type CallBackTarget = "ocbc_hotline" | "scamshield" | "police";

export const OFFICIAL_CONTACTS: { target: CallBackTarget; tel: string; number: string }[] = [
  { target: "ocbc_hotline", tel: "+6563633333", number: "6363 3333" },
  { target: "scamshield", tel: "1799", number: "1799" },
  { target: "police", tel: "18002550000", number: "1800 255 0000" },
];
