"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { AuthModal } from "@/components/auth-modal";
import { useIsMobile } from "@/hooks/use-mobile";
import { WordContent } from "./word-content";
import { useWordDetail } from "./use-word-detail";

interface WordDetailCardProps {
  wordId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WordDetailCard({
  wordId,
  open,
  onOpenChange,
}: WordDetailCardProps) {
  const isMobile = useIsMobile();
  const {
    word,
    isLoading,
    categories,
    isFavorite,
    isTogglingFav,
    isAuthenticated,
    isOnline,
    audioSrc,
    isCached,
    isDownloading,
    downloadProgress,
    storageInfo,
    authModalOpen,
    setAuthModalOpen,
    handleToggleFavorite,
  } = useWordDetail(wordId, open);

  // Shared content props
  const contentProps = {
    word,
    isLoading,
    categories,
    isFavorite,
    isTogglingFav,
    isAuthenticated,
    isOnline,
    audioSrc,
    isCached,
    isDownloading,
    downloadProgress,
    storageInfo,
    onToggleFavorite: handleToggleFavorite,
    onLoginClick: () => setAuthModalOpen(true),
  };

  return (
    <>
      {/* ─── Desktop: Centered Dialog (Modal) ──────────────────────────────── */}
      {!isMobile && (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="max-h-[88dvh] gap-0 overflow-hidden p-0 md:max-w-4xl lg:max-w-5xl">
            <DialogHeader className="contents">
              <DialogTitle className="sr-only">
                {word ? word.spanish : "Detalle de palabra"}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Detalle completo de la palabra seleccionada
              </DialogDescription>
            </DialogHeader>
            <WordContent {...contentProps} />
          </DialogContent>
        </Dialog>
      )}

      {/* ─── Mobile: Sheet (Side Drawer) ───────────────────────────────────── */}
      {isMobile && (
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
            <SheetHeader className="pb-0">
              <SheetTitle className="sr-only">
                {word ? word.spanish : "Detalle de palabra"}
              </SheetTitle>
              <SheetDescription className="sr-only">
                Detalle completo de la palabra seleccionada
              </SheetDescription>
            </SheetHeader>
            <div className="mt-2 px-4 pb-10">
              <WordContent {...contentProps} />
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* Auth modal for non-authenticated users */}
      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} />
    </>
  );
}
