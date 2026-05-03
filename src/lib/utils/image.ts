/**
 * Generates a URL to the image optimization proxy endpoint.
 * Converts external images to resized WebP format.
 */
export const optimizedImageUrl = (
	src: string,
	width = 300,
	quality = 75
): string => {
	return `/api/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality}`;
};
