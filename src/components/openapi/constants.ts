// OpenAPI Editor Constants

export const DEFAULT_OPENAPI_YAML = `openapi: "3.0.3"
info:
  title: Sample API
  description: A sample API to demonstrate OpenAPI editor
  version: "1.0.0"
  contact:
    name: API Support
    email: support@example.com
  license:
    name: MIT
    url: https://opensource.org/licenses/MIT

servers:
  - url: https://api.example.com/v1
    description: Production server
  - url: https://staging.api.example.com/v1
    description: Staging server

tags:
  - name: users
    description: User management operations
  - name: products
    description: Product operations

paths:
  /users:
    get:
      tags:
        - users
      summary: List all users
      description: Returns a paginated list of users with optional filtering
      operationId: listUsers
      parameters:
        - name: limit
          in: query
          description: Maximum number of users to return
          required: false
          schema:
            type: integer
            default: 10
            minimum: 1
            maximum: 100
        - name: offset
          in: query
          description: Number of users to skip
          required: false
          schema:
            type: integer
            default: 0
        - name: Authorization
          in: header
          description: Bearer token for authentication
          required: true
          schema:
            type: string
          example: "Bearer eyJhbGciOiJIUzI1NiIs..."
        - name: X-Request-ID
          in: header
          description: Unique request identifier for tracing
          required: false
          schema:
            type: string
            format: uuid
      responses:
        "200":
          description: A paginated list of users
          headers:
            X-Total-Count:
              description: Total number of users
              schema:
                type: integer
            X-Page-Size:
              description: Number of items per page
              schema:
                type: integer
            X-Request-ID:
              description: Echo of request ID for tracing
              schema:
                type: string
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: "#/components/schemas/User"
                  pagination:
                    $ref: "#/components/schemas/Pagination"
              example:
                data:
                  - id: "550e8400-e29b-41d4-a716-446655440000"
                    name: "John Doe"
                    email: "john@example.com"
                    createdAt: "2024-01-15T10:30:00Z"
                pagination:
                  total: 100
                  limit: 10
                  offset: 0
        "401":
          description: Unauthorized - Invalid or missing token
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
              example:
                code: "UNAUTHORIZED"
                message: "Invalid or expired token"
    post:
      tags:
        - users
      summary: Create a new user
      description: Creates a new user in the system
      operationId: createUser
      parameters:
        - name: Authorization
          in: header
          description: Bearer token for authentication
          required: true
          schema:
            type: string
        - name: Content-Type
          in: header
          description: Content type of the request body
          required: true
          schema:
            type: string
            enum:
              - application/json
      requestBody:
        description: User data to create
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/CreateUserRequest"
            example:
              name: "Jane Smith"
              email: "jane@example.com"
      responses:
        "201":
          description: User created successfully
          headers:
            Location:
              description: URL of the created user
              schema:
                type: string
                format: uri
            X-Request-ID:
              description: Request ID for tracing
              schema:
                type: string
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/User"
              example:
                id: "550e8400-e29b-41d4-a716-446655440001"
                name: "Jane Smith"
                email: "jane@example.com"
                createdAt: "2024-01-16T14:20:00Z"
        "400":
          description: Invalid request body
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
        "409":
          description: User with this email already exists
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"

  /users/{userId}:
    get:
      tags:
        - users
      summary: Get user by ID
      description: Returns a single user by their unique identifier
      operationId: getUserById
      parameters:
        - name: userId
          in: path
          description: Unique identifier of the user
          required: true
          schema:
            type: string
            format: uuid
          example: "550e8400-e29b-41d4-a716-446655440000"
        - name: Authorization
          in: header
          description: Bearer token
          required: true
          schema:
            type: string
      responses:
        "200":
          description: User details
          headers:
            Cache-Control:
              description: Cache control directive
              schema:
                type: string
            ETag:
              description: Entity tag for caching
              schema:
                type: string
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/User"
        "404":
          description: User not found
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
              example:
                code: "NOT_FOUND"
                message: "User with the specified ID was not found"
    delete:
      tags:
        - users
      summary: Delete user by ID
      description: Permanently deletes a user from the system
      operationId: deleteUserById
      parameters:
        - name: userId
          in: path
          description: Unique identifier of the user to delete
          required: true
          schema:
            type: string
            format: uuid
          example: "550e8400-e29b-41d4-a716-446655440000"
        - name: Authorization
          in: header
          description: Bearer token for authentication
          required: true
          schema:
            type: string
        - name: X-Confirm-Delete
          in: header
          description: Confirmation header to prevent accidental deletion
          required: true
          schema:
            type: string
            enum:
              - "true"
      responses:
        "204":
          description: User deleted successfully
          headers:
            X-Request-ID:
              description: Request ID for tracing
              schema:
                type: string
            X-Deleted-At:
              description: Timestamp when the user was deleted
              schema:
                type: string
                format: date-time
        "404":
          description: User not found
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
        "403":
          description: Forbidden - insufficient permissions
          headers:
            X-Required-Permission:
              description: The permission required to perform this action
              schema:
                type: string

components:
  schemas:
    User:
      type: object
      description: Represents a user in the system
      properties:
        id:
          type: string
          format: uuid
          description: Unique identifier
        name:
          type: string
          description: User's full name
          minLength: 1
          maxLength: 100
        email:
          type: string
          format: email
          description: User's email address
        createdAt:
          type: string
          format: date-time
          description: Timestamp when the user was created
      required:
        - id
        - name
        - email

    CreateUserRequest:
      type: object
      description: Request body for creating a new user
      properties:
        name:
          type: string
          description: User's full name
          minLength: 1
          maxLength: 100
        email:
          type: string
          format: email
          description: User's email address
      required:
        - name
        - email

    Pagination:
      type: object
      description: Pagination metadata
      properties:
        total:
          type: integer
          description: Total number of items
        limit:
          type: integer
          description: Items per page
        offset:
          type: integer
          description: Number of items skipped

    Error:
      type: object
      description: Error response
      properties:
        code:
          type: string
          description: Error code
        message:
          type: string
          description: Human-readable error message
        details:
          type: array
          items:
            type: object
            properties:
              field:
                type: string
              message:
                type: string
      required:
        - code
        - message

  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: JWT token obtained from /auth/login
    apiKey:
      type: apiKey
      in: header
      name: X-API-Key
      description: API key for service-to-service calls

security:
  - bearerAuth: []
`;

export const METHOD_COLORS: Record<string, string> = {
  get: 'bg-green-500/20 text-green-400 border-green-500/30',
  post: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  put: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  patch: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  delete: 'bg-red-500/20 text-red-400 border-red-500/30',
  head: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  options: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  query: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
};

