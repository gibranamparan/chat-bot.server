// import { ApolloClient, InMemoryCache, gql } from '@apollo/client';
require('dotenv').config();
const { ApolloClient, InMemoryCache, gql } = require('@apollo/client/core');
// Initialize Apollo Client
const client = new ApolloClient({
    uri: 'http://headend:5000/graphql',
    cache: new InMemoryCache(),
});



const getAllResidents = async () => {
    try {
        const { data } = await client.query({
            query: gql`
                query GetAllResidents {
                    residents {
                        id
                        firstName
                        lastName
                        location {
                            id
                            name
                        }
                        devices {
                            id
                            name
                            flavor
                        }
                        pictureUrl
                    }
                }
          `,
        });
        return data.residents;
    } catch (error) {
        console.error('Error fetching residents:', error);
        throw error;
    }
};

const getAllResidentsDescription = {
    type: 'function',
    function: {
        name: 'getAllResidents',
        description: 'Get all residents. Returns a list of all residents.',
        strict: true,
        parameters: {
            type: 'object',
            properties: {},
            required: [],
            additionalProperties: false
        }
    }
}

const getResidentsByName = async (firstName, lastName) => {
    try {
        const { data } = await client.query({
            query: gql`
                query GetResidentsByName($firstName: String, $lastName: String) {
                    residents(filter: { firstName: $firstName, lastName: $lastName }) {
                        id
                        firstName
                        lastName
                        location {
                            id
                            name
                        }
                        devices {
                            id
                            name
                            flavor
                        }
                        pictureUrl
                    }
                }
          `,
            variables: { firstName, lastName },
        });
        return data.residents;
    } catch (error) {
        console.error('Error fetching residents:', error);
        throw error;
    }
};

const getResidentsByNameDescription = {
    type: 'function',
    function: {
        name: 'getResidentsByName',
        description: 'Search for residents by their first name and/or last name. Returns a list of residents that match the search criteria. In the results we can find where does the resident live (location).',
        strict: true,
        parameters: {
            type: 'object',
            properties: {
                firstName: {
                    type: 'string',
                    description: 'The first name to search for'
                },
                lastName: {
                    type: 'string',
                    description: 'The last name to search for'
                }
            },
            required: ['firstName', 'lastName'],
            additionalProperties: false
        }
    }
};

const getLocationsByName = async (name) => {
    const { data } = await client.query({
        query: gql`
            query GetLocationsByName($name: String) {
                locations(filter: {name: $name}) {
                    id
                    name
                    residents {
                        id
                        firstName
                        lastName
                        name

                    }
                    devices {
                        id
                        name
                        flavor
                    }
                }
            }
        `,
        variables: { name },
    });
    return data.locations;
}

const getLocationsByNameDescription = {
    type: 'function',
    function: {
        name: 'getLocationsByName',
        description: 'Search for locations by their name. Returns a list of locations that match the search criteria. In the results we can find who lives in the location (residents).',
        strict: true,
        parameters: {
            type: 'object',
            properties: {
                name: {
                    type: 'string',
                    description: 'The name to search for'
                }
            },
            required: ['name'],
            additionalProperties: false
        }
    }
}

const handleToolCall = async (toolCall) => {
    try {
        const { name, arguments: args } = toolCall.function;
        const parsedArgs = JSON.parse(args);

        let result;
        switch (name) {
            case 'getAllResidents':
                result = await getAllResidents();
                break;
            case 'getResidentsByName':
                result = await getResidentsByName(parsedArgs.firstName, parsedArgs.lastName);
                break;
            case 'getLocationsByName':
                result = await getLocationsByName(parsedArgs.name);
                break;
            default:
                result = "Unknown function";
        }

        return {
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result)
        };
    } catch (error) {
        console.error('Error handling tool call:', error.message);
        return {
            role: "tool",
            tool_call_id: toolCall.id,
            content: error.message
        };
    }
}

// Don't forget to export the description
module.exports = {
    handleToolCall,
    descriptions: [getAllResidentsDescription, getResidentsByNameDescription, getLocationsByNameDescription]
};