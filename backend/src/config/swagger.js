const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'DJ Clownfish API',
      version: '1.0.0',
      description: 'AI-Powered DJ Voting Application API Documentation',
      contact: {
        name: 'API Support',
        email: 'support@djclownfish.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000/api/v1',
        description: 'Development server (v1)'
      },
      {
        url: 'https://your-production-url.com/api/v1',
        description: 'Production server (v1)'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from /api/auth/login or /api/auth/signup'
        },
        apiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key for AI agent endpoints'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Unique user identifier'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address'
            },
            name: {
              type: 'string',
              description: 'User full name'
            },
            role: {
              type: 'string',
              enum: ['user', 'admin'],
              description: 'User role'
            },
            apiConsumption: {
              type: 'object',
              properties: {
                callsUsed: { type: 'integer' },
                callsLimit: { type: ['integer', 'string'] },
                remainingCalls: { type: 'integer' },
                hasExceededLimit: { type: 'boolean' },
                hasUnlimitedCalls: { type: 'boolean' },
                endpointBreakdown: { type: 'array' }
              }
            }
          }
        },
        Round: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Unique round identifier'
            },
            ownerId: {
              type: 'string',
              description: 'ID of the round owner'
            },
            status: {
              type: 'string',
              enum: ['active', 'paused', 'completed'],
              description: 'Round status'
            },
            currentRoundNumber: {
              type: 'integer',
              description: 'Current round number (starts at 1)'
            },
            genre: {
              type: 'string',
              description: 'Music genre'
            },
            bpm: {
              type: 'integer',
              description: 'Beats per minute'
            },
            artists: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of preferred artists'
            },
            mood: {
              type: 'string',
              description: 'Mood descriptor'
            },
            energy: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              description: 'Energy level'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Song: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Unique song identifier'
            },
            roundId: {
              type: 'string',
              description: 'ID of the voting round'
            },
            roundNumber: {
              type: 'integer',
              description: 'Round number this song belongs to'
            },
            title: {
              type: 'string',
              description: 'Song title'
            },
            artist: {
              type: 'string',
              description: 'Artist name'
            },
            spotifyId: {
              type: 'string',
              description: 'Spotify track ID'
            },
            spotifyUri: {
              type: 'string',
              description: 'Spotify track URI'
            },
            previewUrl: {
              type: 'string',
              format: 'uri',
              description: 'Preview audio URL'
            },
            albumArt: {
              type: 'string',
              format: 'uri',
              description: 'Album artwork URL'
            }
          }
        },
        VotingResults: {
          type: 'object',
          properties: {
            roundId: {
              type: 'string'
            },
            roundNumber: {
              type: 'integer'
            },
            totalVotes: {
              type: 'integer',
              description: 'Total number of votes cast'
            },
            winner: {
              $ref: '#/components/schemas/Song'
            },
            songs: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  song: { $ref: '#/components/schemas/Song' },
                  votes: { type: 'integer' },
                  percentage: { type: 'number' }
                }
              }
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              description: 'Error message'
            },
            error: {
              type: 'string',
              description: 'Detailed error information'
            }
          }
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              description: 'Success message'
            },
            data: {
              type: 'object',
              description: 'Response data'
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and registration endpoints'
      },
      {
        name: 'AI Agent',
        description: 'AI agent communication endpoints'
      },
      {
        name: 'Voting',
        description: 'Voting round management and voting endpoints'
      },
      {
        name: 'Spotify',
        description: 'Spotify integration endpoints'
      },
      {
        name: 'Admin',
        description: 'Administrative endpoints for API statistics'
      },
      {
        name: 'Jukebox',
        description: 'Jukebox mode management endpoints'
      },
      {
        name: 'Health',
        description: 'Health check endpoints'
      }
    ]
  },
  apis: ['./src/routes/*.js', './index.js'] // Paths to files containing OpenAPI definitions
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;

