## GH-49:
**Title** - Add gRPC Request Type Support to Fetchy
**Status:** PUSHING
**Link:** https://github.com/akineralkan/fetchy/issues/49
**Description:**
Add support for gRPC as a new request type in Fetchy alongside existing HTTP options.

Users should be able to:
- Select gRPC as the request type in the UI
- Specify a proto file or service definition (load and parse .proto files)
- Choose a service and method from the available gRPC services
- Input request payload in JSON or protobuf format
- View response data with proper formatting
- Support metadata/headers in gRPC calls
- Handle streaming requests (unary, server streaming, client streaming, bidirectional)

Acceptance Criteria:
- gRPC request type is selectable in the UI
- Users can load and parse .proto files
- Request/response payloads are properly serialized/deserialized
- Metadata and headers are supported
- Basic streaming scenarios are functional
