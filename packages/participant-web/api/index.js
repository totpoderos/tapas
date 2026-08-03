// The participant app's own copy of the API.
//
// Its own, and not a link to the host app's, because a voter's session cookie
// is first-party too: the app and the API it calls have to answer on one
// origin. Two deployments, one database — which is the whole reason the rate
// limit and the migrations were made to count across instances rather than
// within one.
//
// Committed for the same reason the host's is: the platform checks that the
// function exists in the cloned repository before it runs the build.
export { default } from '../serverless/bundle.js';
