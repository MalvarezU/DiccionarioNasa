"use client";

import { useState, useRef, useCallback } from "react";
import { Play, Pause, RotateCcw, Loader2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface AudioPlayerProps {
  src: string | null;
  wordLabel: string;
}

function AudioPlayerInner({ src, wordLabel }: { src: string; wordLabel: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      setIsLoading(true);
      audio.play().then(() => {
        setIsPlaying(true);
        setIsLoading(false);
      }).catch(() => {
        setIsLoading(false);
        setIsPlaying(false);
      });
    }
  }, [isPlaying]);

  const handleRestart = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.currentTime = 0;
    if (!isPlaying) {
      setIsLoading(true);
      audio.play().then(() => {
        setIsPlaying(true);
        setIsLoading(false);
      }).catch(() => {
        setIsLoading(false);
      });
    }
  }, [isPlaying]);

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    setCurrentTime(audio.currentTime);
    if (audio.duration && isFinite(audio.duration)) {
      setProgress((audio.currentTime / audio.duration) * 100);
      setDuration(audio.duration);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current;
    if (audio && isFinite(audio.duration)) {
      setDuration(audio.duration);
    }
    setIsLoading(false);
  }, []);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
  }, []);

  const handleSeek = useCallback((value: number[]) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;

    const seekValue = value[0];
    const newTime = (seekValue / 100) * duration;
    audio.currentTime = newTime;
    setProgress(seekValue);
    setCurrentTime(newTime);
  }, [duration]);

  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds) || seconds < 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-muted/30 border border-border/50 p-3">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onCanPlay={() => setIsLoading(false)}
        preload="metadata"
      />

      <div className="flex items-center gap-2">
        {/* Play / Pause */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full bg-primary/10 hover:bg-primary/20 shrink-0"
          onClick={handlePlayPause}
          disabled={isLoading}
          aria-label={isPlaying ? "Pausar audio" : "Reproducir audio"}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 text-primary animate-spin" />
          ) : isPlaying ? (
            <Pause className="h-4 w-4 text-primary" />
          ) : (
            <Play className="h-4 w-4 text-primary ml-0.5" />
          )}
        </Button>

        {/* Restart */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full hover:bg-muted/60 shrink-0"
          onClick={handleRestart}
          disabled={isLoading}
          aria-label="Reproducir de nuevo"
        >
          <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>

        {/* Progress bar */}
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <Slider
            value={[progress]}
            max={100}
            step={0.1}
            onValueChange={handleSeek}
            className="flex-1 cursor-pointer"
            aria-label="Progreso del audio"
          />
        </div>

        {/* Time display */}
        <span className="text-xs text-muted-foreground tabular-nums shrink-0 w-16 text-right">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      {/* Label */}
      <p className="text-xs text-muted-foreground pl-1">
        Pronunciación en Nasa Yuwe: <span className="font-medium text-foreground">{wordLabel}</span>
      </p>
    </div>
  );
}

export function AudioPlayer({ src, wordLabel }: AudioPlayerProps) {
  // No audio available
  if (!src) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-muted/40 border border-border/50">
        <VolumeX className="h-5 w-5 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Audio no disponible</span>
      </div>
    );
  }

  // Key={src} ensures inner component remounts and resets all state when src changes
  return <AudioPlayerInner key={src} src={src} wordLabel={wordLabel} />;
}
