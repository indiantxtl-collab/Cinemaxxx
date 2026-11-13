"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useCatalogue } from "@/components/CatalogueProvider";
import { COLLECTION_SPECS, matchesCollection, tokens } from "@/lib/catalogue";
import { catalogueTokens } from "@/lib/platforms";
import CollectionTile from "@/components/CollectionTile";
import { CATEGORY_BROWSER_SECTIONS } from "@/lib/navigation";
import Artwork from "@/components/Artwork";
import Icon, { collectionIcon } from "@/components/Icon";
import EmptyState from "@/components/EmptyState";
import CinematicButton from "@/components/CinematicButton";

export default function CategoriesPage() {
  const { movies, categories, channels, loading, error, refresh } = useCatalogue();
  const enabledCategories = categories.filter((category) => category.enabled);
  const managedSlugs = useMemo(() => new Set(categories.map((category) => category.slug)), [categories]);

  const collectionsBySlug = useMemo(() => {
    const map = new Map<
      string,
      { id: string; slug: string; name: string; titles: typeof movies; image?: string | null; channelCount: number }
    >();

    const allSpecs = [
      ...enabledCategories.map((c) => ({ slug: c.slug, name: c.name })),
      ...COLLECTION_SPECS.filter((s) => !managedSlugs.has(s.slug)).map((s) => ({ slug: s.slug, name: s.name })),
      // Platform tokens live in the same catalogue field, but they are not
      // content categories — they are surfaced by the home platform rail.
      ...[
        ...new Set(
          movies.flatMap((movie) => [
            ...catalogueTokens(movie.category).map((token) => token.toLowerCase().replace(/\s+/g, "-")),
            ...tokens(movie.genre),
          ])
        ),
      ].map((slug) => ({
        slug,
        name: slug.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
      })),
    ];

    for (const item of allSpecs) {
      const slug = item.slug.toLowerCase();
      if (managedSlugs.has(slug) && !enabledCategories.some((category) => category.slug === slug)) continue;
      if (map.has(slug)) continue;
      const managed = enabledCategories.find((category) => category.slug === slug);
      const titles = movies.filter((movie) => matchesCollection(movie, slug));
      const numberOfChannels = managed ? channels.filter((channel) => channel.categoryId === managed.id).length : 0;
      if (titles.length === 0 && numberOfChannels === 0) continue;
      const artwork = titles.find((movie) => movie.backdropUrl) ?? titles[0];
      map.set(slug, {
        id: slug,
        slug,
        name: item.name,
        titles,
        channelCount: numberOfChannels,
        image: artwork?.backdropUrl || artwork?.posterUrl || channels.find((channel) => channel.categoryId === managed?.id && channel.logoUrl)?.logoUrl,
      });
    }
    return map;
  }, [movies, enabledCategories, managedSlugs, channels]);

  const collections = useMemo(() => Array.from(collectionsBySlug.values()), [collectionsBySlug]);
  const spotlights = useMemo(
    () =>
      ["trending", "new-releases", "open-access", "coming-soon"]
        .map((slug) => collectionsBySlug.get(slug))
        .filter((item): item is NonNullable<typeof item> => Boolean(item && item.titles.length > 0)),
    [collectionsBySlug]
  );

  const groupedSections = useMemo(() => {
    const sections = CATEGORY_BROWSER_SECTIONS.map((section) => ({
      ...section,
      items: section.items
        .filter((item) => !managedSlugs.has(item.slug))
        .map((item) => {
          const entry = collectionsBySlug.get(item.slug);
          if (!entry) return null;
          return {
            ...entry,
            name: collectionsBySlug.get(item.slug)?.name ?? item.label,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null),
    })).filter((section) => section.items.length > 0);
    const managed = enabledCategories.map((category) => collectionsBySlug.get(category.slug))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    if (managed.length) sections.unshift({ id: "managed-categories", title: "Categories", items: managed });
    return sections;
  }, [collectionsBySlug, enabledCategories, managedSlugs]);

  return (
    <main className="secondary-page explore-page" id="main-content" tabIndex={-1}>
      <div className="secondary-page-content">
        <div className="page-heading">
          <h1>Explore</h1>
          <span className="page-count">{!loading && `${movies.length} titles`}</span>
        </div>
        {loading && !collections.length ? (
          <div className="category-grid" aria-busy="true" aria-label="Loading collections">
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <div key={item} className="shimmer category-skeleton" />
            ))}
          </div>
        ) : error ? (
          <EmptyState title="Collections unavailable" description={error} icon="explore">
            <CinematicButton onClick={refresh} icon={<Icon name="refresh" />}>
              Try again
            </CinematicButton>
          </EmptyState>
        ) : !collections.length ? (
          <EmptyState
            title="No collections yet"
            description="Collections appear here when titles are added to the library."
            icon="explore"
          />
        ) : (
          <>
            {spotlights.length > 0 && (
              <div className="explore-spotlights">
                {spotlights.map((item) => (
                  <Link
                    key={item.id}
                    href={`/category/${encodeURIComponent(item.slug)}`}
                    className="collection-spotlight"
                  >
                    <Artwork
                      src={item.image}
                      kind="backdrop"
                      className="collection-artwork"
                      sizes="(max-width: 640px) 100vw, 50vw"
                    />
                    <span className="collection-shade" />
                    <div className="collection-copy">
                      <span className="collection-icon">
                        <Icon name={collectionIcon(item.slug)} />
                      </span>
                      <h2>{item.name}</h2>
                      <span className="collection-count">{item.titles.length + item.channelCount} titles</span>
                    </div>
                    <span className="collection-arrow">
                      <Icon name="arrow-right" />
                    </span>
                  </Link>
                ))}
              </div>
            )}
            {groupedSections.map((section) => (
              <section key={section.id} aria-label={section.title}>
                <div className="section-heading">
                  <h2>{section.title}</h2>
                  <span className="result-count">{section.items.length} categories</span>
                </div>
                <div className="category-grid">
                  {section.items.map((item) => (
                    <CollectionTile
                      key={`${section.id}-${item.slug}`}
                      item={{
                        slug: item.slug,
                        label: item.name,
                        href: `/category/${encodeURIComponent(item.slug)}`,
                        count: item.titles.length + item.channelCount,
                        image: item.image,
                      }}
                    />
                  ))}
                </div>
              </section>
            ))}
          </>
        )}
      </div>
    </main>
  );
}
