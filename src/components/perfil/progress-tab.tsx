"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import type { CourseProgressSummary } from "./types";

interface ProgressTabProps {
  courses: CourseProgressSummary[];
  loading: boolean;
}

/**
 * Tab Mi avance: una tarjeta por curso con portada, barra de avance,
 * última lección y botón Continuar (el curso retoma solo su última
 * visita vía su propio endpoint de progreso). Sin cursos → CTA Explorar.
 */
export function ProgressTab({ courses, loading }: ProgressTabProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" aria-busy="true" aria-label="Cargando tu avance">
        {[0, 1].map((i) => (
          <Card key={i}>
            <Skeleton className="h-32 w-full rounded-t-lg" />
            <div className="space-y-2 p-4">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-9 w-32" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4 rounded-xl border border-dashed border-outline-variant/50">
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-muted/30">
          <GraduationCap className="h-7 w-7 text-muted-foreground/40" aria-hidden="true" />
        </div>
        <p className="text-sm font-medium text-foreground">
          Todavía no empezaste ningún curso
        </p>
        <p className="text-xs text-muted-foreground max-w-sm text-center">
          Cuando completes o visites una lección, tu avance aparecerá aquí.
        </p>
        <Button asChild className="gap-2 min-h-[44px]">
          <Link href="/cursos">
            Explorar cursos
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {courses.map((course) => (
        <Card key={course.courseId} className="overflow-hidden">
          {course.coverImage ? (
            <div className="relative h-32 w-full">
              <Image
                src={course.coverImage}
                alt=""
                fill
                sizes="(max-width: 640px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
          ) : (
            <div
              aria-hidden="true"
              className="flex h-32 w-full items-center justify-center bg-primary-container"
            >
              <GraduationCap className="h-10 w-10 text-primary-foreground/60" />
            </div>
          )}
          <CardHeader className="pb-2">
            <CardTitle className="font-serif text-lg leading-snug">
              {course.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {course.lessonsCompleted} de {course.lessonsTotal}{" "}
                  lecciones
                </span>
                <span className="font-semibold tabular-nums">
                  {course.percent}%
                </span>
              </div>
              <Progress
                value={course.percent}
                aria-label={`${course.lessonsCompleted} de ${course.lessonsTotal} lecciones completadas`}
              />
            </div>
            {course.lastLessonTitle && (
              <p className="truncate text-xs text-muted-foreground">
                Última: {course.lastLessonTitle}
              </p>
            )}
            <Button asChild className="gap-2 min-h-[44px]">
              <Link href={`/cursos/${course.courseId}`}>
                Continuar
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
