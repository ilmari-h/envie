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
  await writeFile('openapi.json', JSON.stringify(openApiDocument, null, 2));
  console.log('OpenAPI document written to openapi.json');
}

main();