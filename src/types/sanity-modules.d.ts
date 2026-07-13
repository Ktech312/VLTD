declare module "@sanity/vision" {
  import type { PluginOptions } from "sanity";

  export function visionTool(...args: unknown[]): PluginOptions;
}

declare module "@sanity/image-url" {
  type ImageUrlBuilder = {
    image(source: object): ImageUrlBuilder;
    width(value: number): ImageUrlBuilder;
    height(value: number): ImageUrlBuilder;
    fit(value: string): ImageUrlBuilder;
    url(): string;
  };

  export function createImageUrlBuilder(client: unknown): ImageUrlBuilder;
}
