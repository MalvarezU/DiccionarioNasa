"use client"

import { Plus, Trash2, Pencil, ArrowUp, ArrowDown, GraduationCap, BookOpen, Loader2, FileText } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { EditLessonModal } from "./edit-lesson-modal"
import { LessonContentModal } from "./lesson-editor/lesson-content-modal"
import { MediaPicker } from "./lesson-editor/media-picker"
import { LESSON_LABEL, STATUS_LABEL } from "./course-types"
import { useCourseManager } from "./use-course-manager"

export function CourseManager({ canDelete = false }: { canDelete?: boolean }) {
  const {
    courses,
    loading,
    error,
    selectedId,
    detail,
    newTitle,
    setNewTitle,
    creating,
    editTitle,
    setEditTitle,
    editDesc,
    setEditDesc,
    editStatus,
    setEditStatus,
    newModuleTitle,
    setNewModuleTitle,
    savingModule,
    savingLesson,
    setEditingLessonId,
    editingLesson,
    editCover,
    setEditCover,
    contentLessonId,
    setContentLessonId,
    contentLesson,
    lessonForm,
    setLessonForm,
    loadDetail,
    handleCreate,
    handleSaveCourse,
    handleDeleteCourse,
    handleAddModule,
    handleDeleteModule,
    moveModule,
    handleAddLesson,
    handleDeleteLesson,
    moveLesson,
    handleMoveFromModal,
  } = useCourseManager()

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Lista */}
      <Card className="lg:col-span-1 h-fit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <GraduationCap className="h-4 w-4 text-primary" />
            Cursos ({courses.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form onSubmit={handleCreate} className="flex gap-2">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Nuevo curso..."
              aria-label="Título del nuevo curso"
              disabled={creating}
            />
            <Button type="submit" size="icon" disabled={creating || !newTitle.trim()} aria-label="Crear curso">
              <Plus className="h-4 w-4" />
            </Button>
          </form>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : (
            <div className="space-y-2">
              {courses.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => void loadDetail(c.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedId === c.id
                      ? "border-primary bg-primary/5"
                      : "border-outline-variant/20 hover:border-primary/40"
                  }`}
                >
                  <p className="text-sm font-medium">{c.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-2xs">
                      {STATUS_LABEL[c.status] ?? c.status}
                    </Badge>
                    <span className="text-2xs text-muted-foreground">
                      {c.modules} módulos · {c.lessons} lecciones
                    </span>
                  </div>
                </button>
              ))}
              {courses.length === 0 && (
                <p className="text-sm text-muted-foreground">Sin cursos. Crea el primero.</p>
              )}
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {/* Detalle */}
      <Card className="lg:col-span-2 h-fit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4 text-primary" />
            {detail ? detail.title : "Selecciona un curso"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!detail ? (
            <p className="text-sm text-muted-foreground">
              Elige un curso de la lista para editar sus módulos y lecciones.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="course-title">Título</Label>
                  <Input
                    id="course-title"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="course-desc">Descripción</Label>
                  <Input
                    id="course-desc"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Estado</Label>
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger className="w-[200px]" aria-label="Estado del curso">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DRAFT">Borrador</SelectItem>
                      <SelectItem value="PUBLISHED">Publicado</SelectItem>
                      <SelectItem value="ARCHIVED">Archivado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* Portada del catálogo (fase 5): sube a Postgres, se muestra en /cursos */}
                <div className="grid gap-2">
                  <Label>Portada</Label>
                  {editCover ? (
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={editCover} alt="Portada del curso" className="h-14 w-24 rounded-md object-cover border border-outline-variant/30" />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setEditCover(null)}
                      >
                        Quitar portada
                      </Button>
                    </div>
                  ) : (
                    <MediaPicker
                      etiqueta="Imagen de portada del curso"
                      onSubida={(url) => setEditCover(url)}
                    />
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveCourse} className="gap-1.5">
                    <Pencil className="h-3.5 w-3.5" />
                    Guardar curso
                  </Button>
                  {canDelete && (
                    <Button size="sm" variant="destructive" onClick={handleDeleteCourse} className="gap-1.5">
                      <Trash2 className="h-3.5 w-3.5" />
                      Eliminar
                    </Button>
                  )}
                </div>
              </div>

              <Separator />

              {/* Módulos */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold">Módulos</h4>
                <form onSubmit={handleAddModule} className="flex gap-2">
                  <Input
                    value={newModuleTitle}
                    onChange={(e) => setNewModuleTitle(e.target.value)}
                    placeholder="Nuevo módulo..."
                    aria-label="Título del nuevo módulo"
                    disabled={savingModule}
                  />
                  <Button type="submit" size="sm" disabled={!newModuleTitle.trim() || savingModule}>
                    {savingModule && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {savingModule ? "Añadiendo..." : "Añadir"}
                  </Button>
                </form>

                {(detail.modules ?? []).map((mod, modIdx) => (
                  <div key={mod.id} className="rounded-lg border border-outline-variant/20 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="flex-1 text-sm font-medium">{mod.title}</p>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        aria-label={`Subir ${mod.title}`}
                        onClick={() => void moveModule(mod.id, -1)}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        aria-label={`Bajar ${mod.title}`}
                        onClick={() => void moveModule(mod.id, 1)}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        aria-label={`Eliminar ${mod.title}`}
                        onClick={() => void handleDeleteModule(mod.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {/* Lecciones */}
                    <div className="pl-2 space-y-1.5">
                      {[...mod.lessons]
                        .sort(
                          (a, b) =>
                            (a.lessonNumber ?? Number.MAX_SAFE_INTEGER) -
                              (b.lessonNumber ?? Number.MAX_SAFE_INTEGER) || a.order - b.order
                        )
                        .map((les) => (
                        <div
                          key={les.id}
                          data-testid="lesson-row"
                          data-lesson-title={les.title}
                          className="flex items-center gap-2 text-sm p-2 rounded bg-muted/30"
                        >
                          <Badge variant="outline" className="text-2xs shrink-0">
                            {modIdx + 1}.{les.lessonNumber ?? "?"}
                          </Badge>
                          <span className="flex-1">
                            {les.title}{" "}
                            <span className="text-2xs text-muted-foreground">
                              ({LESSON_LABEL[les.type] ?? les.type})
                            </span>
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            aria-label={`Editar lección ${les.title}`}
                            onClick={() => setEditingLessonId(les.id)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            aria-label={`Contenido de lección ${les.title}`}
                            onClick={() => setContentLessonId(les.id)}
                          >
                            <FileText className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            aria-label={`Subir lección ${les.title}`}
                            onClick={() => void moveLesson(mod.id, les.id, -1)}
                          >
                            <ArrowUp className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            aria-label={`Bajar lección ${les.title}`}
                            onClick={() => void moveLesson(mod.id, les.id, 1)}
                          >
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            aria-label={`Eliminar lección ${les.title}`}
                            onClick={() => void handleDeleteLesson(les.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}

                      <form
                        onSubmit={(e) => void handleAddLesson(e, mod.id)}
                        className="flex flex-wrap gap-2 pt-1"
                      >
                        <Input
                          value={lessonForm(mod.id).title}
                          onChange={(e) => setLessonForm(mod.id, { title: e.target.value })}
                          placeholder="Nueva lección..."
                          aria-label={`Título de nueva lección en ${mod.title}`}
                          className="flex-1 min-w-[140px] h-8 text-xs"
                          disabled={!!savingLesson[mod.id]}
                        />
                        <Select
                          value={lessonForm(mod.id).type}
                          onValueChange={(type) => setLessonForm(mod.id, { type })}
                        >
                          <SelectTrigger className="w-[120px] h-8 text-xs" aria-label="Tipo de lección">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="READ">Lectura</SelectItem>
                            <SelectItem value="QUIZ">Quiz</SelectItem>
                            <SelectItem value="COMPLETE">Ejercicio</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          value={lessonForm(mod.id).wordSpanish}
                          onChange={(e) => setLessonForm(mod.id, { wordSpanish: e.target.value })}
                          placeholder="Palabra (español)"
                          aria-label="Palabra en español para la lección"
                          className="w-[140px] h-8 text-xs"
                          disabled={!!savingLesson[mod.id]}
                        />
                        <Button
                          type="submit"
                          size="sm"
                          className="h-8 text-xs gap-1.5"
                          disabled={!lessonForm(mod.id).title.trim() || !!savingLesson[mod.id]}
                        >
                          {savingLesson[mod.id] && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                          {savingLesson[mod.id] ? "Añadiendo..." : "Añadir lección"}
                        </Button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <EditLessonModal
        lesson={editingLesson}
        open={editingLesson !== null}
        onOpenChange={(v) => {
          if (!v) setEditingLessonId(null)
        }}
        onSaved={() => {
          if (detail) void loadDetail(detail.id)
        }}
        onMove={handleMoveFromModal}
      />

      <LessonContentModal
        lesson={contentLesson}
        open={contentLesson !== null}
        onOpenChange={(v) => {
          if (!v) setContentLessonId(null)
        }}
        onSaved={() => {
          if (detail) void loadDetail(detail.id)
        }}
      />
    </div>
  )
}
