// The serverless function Vercel looks for.
//
// Committed, and deliberately trivial: the platform validates the `functions`
// pattern against the cloned repository *before* it runs the build, so a file
// generated during the build does not exist yet and the deployment fails with
// "doesn't match any Serverless Functions". A CLI deploy hides this, because
// the generated file is already sitting in the working tree.
//
// What it re-exports is the bundle — every workspace package inlined as
// JavaScript — which the build writes beside the entry it was built from.
export { default } from '../serverless/bundle.js';
