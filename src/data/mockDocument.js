// Fictional document used by the preview.
// Sentences marked with "// FINDING" correspond EXACTLY to an
// `original` entry in mockFindings.js (matched by page + text).
//
// Each page is an array of typed blocks:
//   - { kind: 'heading', text: '...' }  → section heading
//   - { kind: 'p',       text: '...' }  → paragraph / sentence
//
// Sentences that match a finding are rendered as clickable
// highlights inside <DocumentPreview />.

export const MOCK_DOCUMENT = {
  title: "Internal Report \u2014 Q1 2025",
  subtitle: "Quarterly review and action plan",
  pages: [
    // ── Page 1 ──────────────────────────────────────────────
    [
      { kind: 'heading', text: '1. Introduction' },
      {
        kind: 'p',
        text:
          "This document summarizes the first quarter of 2025 and the areas for improvement identified by the various operational teams.",
      },
      {
        kind: 'p',
        text: "Hey team, hope you're all good :)", // FINDING tone
      },
      {
        kind: 'p',
        text:
          "The report presents the key figures for the last quater.", // FINDING spelling
      },
      {
        kind: 'p',
        text:
          "The sales and marketing teams needs to collaborate more closely.", // FINDING grammar
      },
      {
        kind: 'p',
        text:
          "We will discuss each of these points in detail in the following sections.",
      },
    ],

    // ── Page 2 ──────────────────────────────────────────────
    [
      { kind: 'heading', text: '2. Deliverable validation' },
      {
        kind: 'p',
        text:
          "Document governance enforces a multi-level approval process for every document published externally.",
      },
      {
        kind: 'p',
        text:
          "Neither of the documents submitted have been approved by management.", // FINDING grammar
      },
      {
        kind: 'p',
        text:
          "The project will be delivered in Q2 2025 with a budget of \u20ac120k.", // FINDING consistency
      },
      {
        kind: 'p',
        text:
          "A steering committee will meet in April to adjust these items.",
      },
    ],

    // ── Page 3 ──────────────────────────────────────────────
    [
      { kind: 'heading', text: '3. Security and compliance' },
      {
        kind: 'p',
        text:
          "Employees must follow the security procceedure.", // FINDING spelling
      },
      {
        kind: 'p',
        text:
          "Within the framework of the operational implementation of the overall strategy, it will be appropriate, in due course, to articulate the functional building blocks in such a way as to ensure transversal alignment.", // FINDING clarity
      },
      {
        kind: 'p',
        text:
          "Mandatory training is scheduled for all teams during the second quarter.",
      },
    ],

    // ── Page 4 ──────────────────────────────────────────────
    [
      { kind: 'heading', text: '4. Planning and decisions' },
      {
        kind: 'p',
        text:
          "Several decisions were made during the weekly meetings to adjust the project schedule.",
      },
      {
        kind: 'p',
        text:
          "Following Monday's meeting, we has decided to postpone the launch.", // FINDING grammar
      },
      {
        kind: 'p',
        text: "It's just impossible to meet this schedule.", // FINDING tone
      },
      {
        kind: 'p',
        text:
          "A full review of the schedule is underway in coordination with the PMO.",
      },
    ],

    // ── Page 5 ──────────────────────────────────────────────
    [
      { kind: 'heading', text: '5. CSR commitments' },
      {
        kind: 'p',
        text:
          "The company is committed to respecting its CSR committment.", // FINDING spelling
      },
      {
        kind: 'p',
        text:
          "The final deliverable, which will need to be validated by the stakeholders, will be made available.", // FINDING clarity
      },
      {
        kind: 'p',
        text:
          "Detailed commitments and tracking indicators are attached at the end of the document.",
      },
    ],

    // ── Page 6 ──────────────────────────────────────────────
    [
      { kind: 'heading', text: '6. Document management' },
      {
        kind: 'p',
        text:
          "This procedure replaces version v1.2 dated 03/14/2024.", // FINDING consistency
      },
      {
        kind: 'p',
        text: "Please take care of this ASAP.", // FINDING tone
      },
      {
        kind: 'p',
        text:
          "Any change must be reviewed by the quality lead before publication.",
      },
    ],

    // ── Page 7 ──────────────────────────────────────────────
    [
      { kind: 'heading', text: '7. Access security' },
      {
        kind: 'p',
        text:
          "The password management policy was updated this year.",
      },
      {
        kind: 'p',
        text:
          "Users can reset their password at any time.", // FINDING consistency
      },
      {
        kind: 'p',
        text:
          "As a reminder, the IT service is available to support any issue.",
      },
    ],

    // ── Page 8 ──────────────────────────────────────────────
    [
      { kind: 'heading', text: '8. Conclusion' },
      {
        kind: 'p',
        text:
          "The audit highlights several improvement areas that will be addressed in order of priority.",
      },
      {
        kind: 'p',
        text:
          "It is to be noted that a certain number of elements remain to be clarified.", // FINDING clarity
      },
      {
        kind: 'p',
        text:
          "A debrief session will be scheduled next week to share the conclusions.",
      },
    ],
  ],
};
