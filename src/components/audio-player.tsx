"use client";

import { useState, useRef, useCallback } from "react";
import { Play, Pause, RotateCcw, Loader2, VolumeX, CloudOff, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { useOnlineStatus } from "@/hooks/use-online-status";

interface AudioPlayerProps {
  src: string | null;
  wordLabel: string;
  /** Whether the audio is available in offline cache */
  isCached?: boolean;
}

function AudioPlayerInner({ src, wordLabel, isCached }: { src: string; wordLabel: string; isCached?: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const isOnline = useOnlineStatus();

  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // HU1.3.2: If offline and audio is not cached, show message instead of playing
    if (!isOnline && !isCached) {
      return;
    }

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
  }, [isPlaying, isOnline, isCached]);

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

  // HU1.3.2: When offline and audio is not cached, show special message
  const isOfflineNotCached = !isOnline && !isCached;

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
          disabled={isLoading || isOfflineNotCached}
          aria-label={isPlaying ? "Pausar audio" : "Reproducir audio"}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 text-primary animate-spin" />
          ) : isOfflineNotCached ? (
            <WifiOff className="h-4 w-4 text-muted-foreground" />
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
          disabled={isLoading || isOfflineNotCached}
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
            disabled={isOfflineNotCached}
            aria-label="Progreso del audio"
          />
        </div>

        {/* Time display */}
        <span className="text-xs text-muted-foreground tabular-nums shrink-0 w-16 text-right">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      {/* Label + Offline indicator */}
      <div className="flex items-center gap-2 pl-1">
        <p className="text-xs text-muted-foreground">
          Pronunciación en Nasa Yuwe: <span className="font-medium text-foreground">{wordLabel}</span>
        </p>
        {isCached && (
          <Badge variant="secondary" className="h-5 gap-1 text-[10px] px-1.5 bg-primary/10 text-primary border-primary/20">
            <CloudOff className="h-3 w-3" />
            Offline
          </Badge>
        )}
      </div>

      {/* HU1.3.2: Offline message when audio is not cached */}
      {isOfflineNotCached && (
        <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5 pl-1">
          <WifiOff className="h-3 w-3 shrink-0" />
          Audio disponible solo en línea o guardando esta palabra como favorita cuando tengas conexión
        </p>
      )}
    </div>
  );
}

export function AudioPlayer({ src, wordLabel, isCached }: AudioPlayerProps) {
  // No audio available at all
  if (!src) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-muted/40 border border-border/50">
        <VolumeX className="h-5 w-5 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Audio no disponible</span>
      </div>
    );
  }

  // Key={src} ensures inner component remounts and resets all state when src changes
  return <AudioPlayerInner key={src} src={src} wordLabel={wordLabel} isCached={isCached} />;
}
