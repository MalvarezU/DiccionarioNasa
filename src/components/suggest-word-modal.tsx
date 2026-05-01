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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SuggestWordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTerm: string;
}

export function SuggestWordModal({
  open,
  onOpenChange,
  initialTerm,
}: SuggestWordModalProps) {
  const [term, setTerm] = useState(initialTerm);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Update term when initialTerm changes (dialog reopens with new term)
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setTerm(initialTerm);
      setComment("");
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = async () => {
    if (!term.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/dictionary/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term: term.trim(), comment: comment.trim() }),
      });

      if (response.ok) {
        toast({
          title: "¡Sugerencia enviada!",
          description: `Gracias por sugerir «${term.trim()}». La revisaremos pronto.`,
        });
        onOpenChange(false);
        setComment("");
      } else {
        toast({
          title: "Error al enviar",
          description: "No se pudo enviar la sugerencia. Intenta de nuevo.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error de conexión",
        description: "Verifica tu conexión e intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sugerir una palabra</DialogTitle>
          <DialogDescription>
            ¿Conoces una palabra que no está en el diccionario? Sugiere la
            palabra y nuestro equipo la revisará para agregarla.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="suggest-term">Palabra o término</Label>
            <Input
              id="suggest-term"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Escribe la palabra que sugieres..."
              className="h-10"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="suggest-comment">
              Comentario{" "}
              <span className="text-muted-foreground font-normal">
                (opcional)
              </span>
            </Label>
            <Textarea
              id="suggest-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Contexto, significado, uso cultural..."
              rows={3}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!term.trim() || isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Enviar sugerencia
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
