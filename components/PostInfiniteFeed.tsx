'use client';

import { useEffect, useRef, useState } from "react";
import TuitionPost from "@/components/PostCards/TuitionPost";
import InlineAdCard from "@/components/InlineAdCard";
import { reportClientError } from "@/lib/client-report-error";

const PAGE_SIZE = 10;
const EDITED_THRESHOLD_MS = 1000;

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type TuitionPostItem = {
  postId: string;
  enquiryId?: { toString(): string } | string | null;
  guardianName?: string;
  guardianPhone?: string;
  students: Array<{
    className: string;
    board: string;
    subjects: string[];
  }>;
  preferredTime?: string;
  preferredDays?: string[];
  frequencyPerWeek: number;
  classType: "online" | "offline" | "both";
  location?: string;
  monthlyBudget?: number;
  notes?: string;
  status: "open" | "matched" | "closed" | "cancelled" | "hold";
  createdAt: Date | string;
  updatedAt: Date | string;
  author?: { name?: string; avatarUrl?: string | null } | null;
  updatedByAdminClerkId?: string | null;
};

type InlineAd = {
  adId: string;
  title: string;
  adType: "image" | "text" | "html";
  placement: string;
  imageUrl?: string;
  content?: string;
  targetUrl?: string;
  advertiser: string;
};

type PostFilters = {
  search?: string;
  status?: string;
  subjects?: string;
  boards?: string;
  classType?: string;
  minBudget?: string;
  maxBudget?: string;
};

function buildQuery(filters: PostFilters, page: number) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value && value !== "all") {
      params.set(key, value);
    }
  });

  params.set("page", String(page));
  params.set("limit", String(PAGE_SIZE));
  return params.toString();
}

export default function PostInfiniteFeed({
  initialPosts,
  initialPagination,
  filters,
  featuredAd,
}: {
  initialPosts: TuitionPostItem[];
  initialPagination: Pagination;
  filters: PostFilters;
  featuredAd?: InlineAd | null;
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [pagination, setPagination] = useState(initialPagination);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestedPageRef = useRef(initialPagination.page);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setPosts(initialPosts);
    setPagination(initialPagination);
    setIsLoadingMore(false);
    setErrorMessage(null);
    requestedPageRef.current = initialPagination.page;
  }, [initialPosts, initialPagination]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || pagination.page >= pagination.totalPages) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || isLoadingMore) {
          return;
        }

        setIsLoadingMore(true);
        setErrorMessage(null);

        const nextPage = pagination.page + 1;
        if (requestedPageRef.current >= nextPage) {
          setIsLoadingMore(false);
          return;
        }

        requestedPageRef.current = nextPage;
        void fetch(`/api/v1/posts?${buildQuery(filters, nextPage)}`)
          .then(async (response) => {
            if (!response.ok) {
              throw new Error("Failed to load more posts");
            }

            return response.json() as Promise<{
              posts: TuitionPostItem[];
              pagination: Pagination;
            }>;
          })
          .then((data) => {
            setPosts((current) => {
              const seen = new Set(current.map((post) => post.postId));
              const merged = [...current];

              data.posts.forEach((post) => {
                if (!seen.has(post.postId)) {
                  merged.push(post);
                }
              });

              return merged;
            });
            setPagination(data.pagination);
          })
          .catch((error) => {
            reportClientError(error, { feature: "public-tuition-feed" });
            setErrorMessage("Could not load more posts right now.");
          })
          .finally(() => {
            setIsLoadingMore(false);
          });
      },
      { rootMargin: "400px 0px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [filters, isLoadingMore, pagination.page, pagination.totalPages]);

  if (posts.length === 0) {
    return <p className="mt-10 text-default-500">No posts found</p>;
  }

  const adInsertIndex = featuredAd ? Math.min(4, posts.length - 1) : -1;

  return (
    <div className="w-full max-w-md mt-6 space-y-4">
      {posts.map((post, index) => (
        <div key={post.postId} className="space-y-4">
          <TuitionPost
            postId={post.postId}
            enquiryId={post.enquiryId?.toString()}
            guardianName={post.guardianName}
            guardianPhone={post.guardianPhone}
            students={post.students}
            preferredTime={post.preferredTime}
            preferredDays={post.preferredDays}
            frequencyPerWeek={post.frequencyPerWeek}
            classType={post.classType}
            location={post.location}
            monthlyBudget={post.monthlyBudget}
            notes={post.notes}
            status={post.status}
            createdAt={new Date(post.createdAt)}
            updatedAt={new Date(post.updatedAt)}
            initialApplied={false}
            isEdited={
              Boolean(post.updatedByAdminClerkId) ||
              new Date(post.updatedAt).getTime() -
                new Date(post.createdAt).getTime() >
                EDITED_THRESHOLD_MS
            }
            createdByUserId={{
              name: post.author?.name,
              avatar: post.author?.avatarUrl,
            }}
          />

          {featuredAd && index === adInsertIndex ? (
            <InlineAdCard ad={featuredAd} />
          ) : null}
        </div>
      ))}

      {pagination.page < pagination.totalPages ? (
        <div ref={sentinelRef} className="flex flex-col items-center gap-2 py-4">
          {isLoadingMore ? (
            <p className="text-sm text-default-400">Loading more posts...</p>
          ) : (
            <p className="text-sm text-default-400">Scroll to load more</p>
          )}
          {errorMessage ? (
            <p className="text-sm text-danger">{errorMessage}</p>
          ) : null}
        </div>
      ) : (
        <p className="py-4 text-center text-sm text-default-400">
          You have reached the end.
        </p>
      )}
    </div>
  );
}
