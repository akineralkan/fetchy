# Key Decisions

[GH-49] - DEVELOPMENT: UrlBar.tsx had a duplicate `onShowCode` property declaration and extra closing brace after the interface, causing TS1109/TS1128 syntax errors. Decision: Remove the duplicate lines (lines 41-42).

[GH-49] - DEVELOPMENT: RequestPanel.tsx imported GrpcEditor and defined handleGrpcSend/handleGrpcChange/handleModeChange but never wired them into the JSX. Decision: Add an `isGrpcMode` check that renders an early-return path with GrpcEditor for gRPC mode, and pass the new appMode/onModeChange/serverAddress/onServerAddressChange props to UrlBar.

[GH-49] - DEVELOPMENT: Three pre-existing unused-import TS errors existed in App.tsx, EnvironmentModal.tsx, and RequestPanel.tsx. Decision: Remove the unused symbols to achieve a clean `npx tsc --noEmit` build as required by the task constraints.

[GH-49] - TEST FINDING: requireServerAddress only rejects scheme://host patterns (with ://). A `javascript:alert(1)` address (single colon, no //) passes validation and would fail at the gRPC client connection level. This is acceptable behavior since gRPC clients treat the string as an opaque address and there is no script execution risk.

[GH-49] - TEST FINDING: vi.mock() does not intercept CJS require() calls when test files are TypeScript in vitest 0.34.x Node environment. Direct property patching on the CJS module cache object is required to mock fs.existsSync and @grpc/proto-loader.load reliably.