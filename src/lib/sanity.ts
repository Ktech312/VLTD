import { createClient } from 'next-sanity'

export const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? '8e3vk2vl',
  dataset: 'production',
  apiVersion: '2024-01-01',
  useCdn: true,
})

export async function getArticles() {
  return client.fetch(`
    *[_type == "article"] | order(publishedAt desc) {
      _id, title, slug, category, excerpt, publishedAt, heroImage
    }
  `)
}

export async function getArticle(slug: string) {
  return client.fetch(`
    *[_type == "article" && slug.current == $slug][0] {
      _id, title, slug, category, excerpt,
      body, publishedAt, heroImage,
      seoTitle, seoDescription
    }
  `, { slug })
}
