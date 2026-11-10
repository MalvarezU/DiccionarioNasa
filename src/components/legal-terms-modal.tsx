"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PrivacyDocument,
  TermsDocument,
  LEGAL_UPDATED_LABEL,
  LEGAL_VERSION,
} from "@/components/legal-content";

export type LegalTab = "terms" | "privacy";

interface LegalTermsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: LegalTab;
  onAccept: () => void;
}

export function LegalTermsModal({
  open,
  onOpenChange,
  initialTab = "terms",
  onAccept,
}: LegalTermsModalProps) {
  const [tab, setTab] = useState<LegalTab>(initialTab);

  const handleOpenChange = (value: boolean) => {
    if (value) setTab(initialTab);
    onOpenChange(value);
  };

  const handleAccept = () => {
    onAccept();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-2xl lg:max-w-4xl max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden"
        aria-label="Términos y Política de Privacidad"
      >
        <DialogHeader className="px-6 pt-6 pb-4 sm:px-8 text-left">
          <DialogTitle>Términos y Privacidad</DialogTitle>
          <DialogDescription>
            Lee el resumen y el texto completo. Al aceptar confirmas que estás
            de acuerdo con ambos documentos. Versión {LEGAL_VERSION} ·{" "}
            {LEGAL_UPDATED_LABEL}.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as LegalTab)}
          className="flex min-h-0 flex-1 flex-col px-6 sm:px-8"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="terms">Términos y Condiciones</TabsTrigger>
            <TabsTrigger value="privacy">Política de Privacidad</TabsTrigger>
          </TabsList>
          <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1 pb-4">
            <TabsContent value="terms" className="mt-0">
              <TermsDocument />
            </TabsContent>
            <TabsContent value="privacy" className="mt-0">
              <PrivacyDocument />
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="border-t px-6 py-4 sm:px-8">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button type="button" onClick={handleAccept}>
            Aceptar términos y privacidad
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
