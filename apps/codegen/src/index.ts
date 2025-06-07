import { contract } from '@repo/rest';
import { generateOpenApi } from '@ts-rest/open-api';
import { mkdir, writeFile } from 'node:fs/promises';

function generateOpenApiDocument() {
  const openApiDocument = generateOpenApi(
    contract,
    {
      info: {
        title: 'Envie API',
        version: '1.0.0',
      },
    },
  );
  return openApiDocument;
}

async function main() {
  const openApiDocument = generateOpenApiDocument();
  
  // Create out directory if it doesn't exist
  await mkdir('out', { recursive: true });
  
  // Write OpenAPI document to file
  await writeFile('out/openapi.json', JSON.stringify(openApiDocument, null, 2));
  console.log('OpenAPI document written to out/openapi.json');
}

main();