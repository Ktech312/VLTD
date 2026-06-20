import { defineConfig, type SchemaTypeDefinition } from 'sanity'
import { deskTool } from 'sanity/desk'
import { visionTool } from '@sanity/vision'
import { schemaTypes } from './sanity/schemas'

export default defineConfig({
  name: 'vltd',
  title: 'VLTD Content',
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? '8e3vk2vl',
  dataset: 'production',
  plugins: [deskTool(), visionTool()],
  schema: { types: schemaTypes as SchemaTypeDefinition[] },
})
