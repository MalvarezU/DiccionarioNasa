"use client";

import { useState, useEffect, useCallback } from "react";
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
import {
  Heart,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { PanelContent } from "./panel-content";
import { type PanelTab } from "./panel-data";

interface FavoritesHistoryPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: PanelTab;
  onWordSelect: (wordId: string) => void;
}

export function FavoritesHistoryPanel({
  open,
  onOpenChange,
  initialTab = "favorites",
  onWordSelect,
}: FavoritesHistoryPanelProps) {
  const isMobile = useIsMobile();
  const [currentTab, setCurrentTab] = useState<PanelTab>(initialTab);

  // Sync tab when initialTab prop changes
  useEffect(() => {
    setCurrentTab(initialTab);
  }, [initialTab]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <>
      {/* ─── Desktop: Centered Dialog (Modal) ──────────────────────────────── */}
      {!isMobile && (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0">
            <div className="p-6">
              <DialogHeader className="pb-0 text-left space-y-0">
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <Heart className="h-5 w-5 text-primary" />
                  Mis Palabras
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Tus palabras favoritas e historial de consultas
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4">
                <PanelContent
                  initialTab={currentTab}
                  onWordSelect={onWordSelect}
                  onClose={handleClose}
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ─── Mobile: Sheet (Side Drawer) ───────────────────────────────────── */}
      {isMobile && (
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
            <SheetHeader className="pb-0">
              <SheetTitle className="flex items-center gap-2 text-lg">
                <Heart className="h-5 w-5 text-primary" />
                Mis Palabras
              </SheetTitle>
              <SheetDescription className="sr-only">
                Tus palabras favoritas e historial de consultas
              </SheetDescription>
            </SheetHeader>
            <div className="mt-2 px-4 pb-10">
              <PanelContent
                initialTab={currentTab}
                onWordSelect={onWordSelect}
                onClose={handleClose}
              />
            </div>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
