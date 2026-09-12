"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@heroui/button";
import { Card, CardBody, CardFooter, CardHeader } from "@heroui/card";
import { Input, Textarea } from "@heroui/input";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { Switch } from "@heroui/switch";
import { Tooltip } from "@heroui/tooltip";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/modal";
import { addToast } from "@heroui/toast";
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  MessageSquareQuote,
  AlertTriangle,
  GripVertical,
  RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import {
  getTeacherReviewsAction,
  createTeacherReviewAction,
  updateTeacherReviewAction,
  deleteTeacherReviewAction,
} from "./actions";

interface TeacherReview {
  _id: string;
  name: string;
  qualification: string;
  experience: number;
  message: string;
  order: number;
  isVisible: boolean;
}

type FormState = {
  name: string;
  qualification: string;
  experience: string;
  message: string;
  order: string;
  isVisible: boolean;
};

const emptyForm: FormState = {
  name: "",
  qualification: "",
  experience: "0",
  message: "",
  order: "0",
  isVisible: true,
};

export default function TeacherReviewsPage() {
  const [reviews, setReviews] = useState<TeacherReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const { isOpen: isFormOpen, onOpen: openForm, onClose: closeForm } = useDisclosure();
  const [editTarget, setEditTarget] = useState<TeacherReview | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const { isOpen: isDeleteOpen, onOpen: openDelete, onClose: closeDelete } = useDisclosure();
  const [deleteTarget, setDeleteTarget] = useState<TeacherReview | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchReviews = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const data = await getTeacherReviewsAction();
      setReviews(data || []);
    } catch {
      setFetchError("Could not load teacher reviews. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const openAdd = () => {
    setEditTarget(null);
    setForm(emptyForm);
    setFormErrors({});
    openForm();
  };

  const openEdit = (review: TeacherReview) => {
    setEditTarget(review);
    setForm({
      name: review.name,
      qualification: review.qualification,
      experience: String(review.experience),
      message: review.message,
      order: String(review.order),
      isVisible: review.isVisible,
    });
    setFormErrors({});
    openForm();
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = "Name is required";
    if (!form.qualification.trim()) errors.qualification = "Qualification is required";
    if (Number.isNaN(Number(form.experience)) || Number(form.experience) < 0) errors.experience = "Invalid experience";
    if (!form.message.trim()) errors.message = "Message is required";
    else if (form.message.trim().length < 5) errors.message = "At least 5 characters";
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setIsSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        qualification: form.qualification.trim(),
        experience: Number(form.experience),
        message: form.message.trim(),
        order: Number(form.order) || 0,
        isVisible: form.isVisible,
      };

      if (editTarget) {
        const res = await updateTeacherReviewAction(editTarget._id, payload);
        if (!res.success) throw new Error(res.error || "Update failed");
        setReviews((prev) =>
          prev.map((r) => (r._id === editTarget._id ? res.teacherReview : r))
        );
        addToast({ description: "Review updated successfully", color: "success" });
      } else {
        const res = await createTeacherReviewAction(payload);
        if (!res.success) throw new Error(res.error || "Create failed");
        setReviews((prev) =>
          [...prev, res.teacherReview].sort((a, b) => a.order - b.order)
        );
        addToast({ description: "Review added successfully", color: "success" });
      }
      closeForm();
    } catch (error: any) {
      addToast({ description: error.message || "Failed to save.", color: "danger" });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleVisibility = async (review: TeacherReview) => {
    try {
      const res = await updateTeacherReviewAction(review._id, { isVisible: !review.isVisible });
      if (!res.success) throw new Error();
      setReviews((prev) =>
        prev.map((r) => (r._id === review._id ? res.teacherReview : r))
      );
      addToast({
        description: `${review.name} is now ${!review.isVisible ? "visible" : "hidden"}`,
        color: "success",
      });
    } catch {
      addToast({ description: "Failed to update visibility", color: "danger" });
    }
  };

  const handleDeleteClick = (review: TeacherReview) => {
    setDeleteTarget(review);
    openDelete();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await deleteTeacherReviewAction(deleteTarget._id);
      if (!res.success) throw new Error();
      setReviews((prev) => prev.filter((r) => r._id !== deleteTarget._id));
      addToast({ description: `"${deleteTarget.name}" deleted`, color: "success" });
      closeDelete();
    } catch {
      addToast({ description: "Failed to delete", color: "danger" });
    } finally {
      setIsDeleting(false);
    }
  };

  const visibleCount = reviews.filter((r) => r.isVisible).length;

  return (
    <div className="container mx-auto px-4 max-w-5xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-default-900 flex items-center gap-2">
            <MessageSquareQuote size={24} className="text-primary" />
            Teacher Reviews
          </h1>
          <p className="text-sm text-default-500 mt-0.5">
            Manage the teacher reviews shown on the homepage testimonials.
          </p>
        </div>
        <Button
          variant="flat"
          size="sm"
          startContent={<RefreshCw size={14} />}
          onPress={fetchReviews}
          isDisabled={isLoading}
        >
          Refresh
        </Button>
      </div>

      {/* Summary */}
      <div className="flex flex-wrap gap-3 items-center">
        <Chip variant="flat" color="primary" startContent={<MessageSquareQuote size={14} />}>
          {reviews.length} Total
        </Chip>
        <Chip variant="flat" color="success" startContent={<Eye size={14} />}>
          {visibleCount} Visible
        </Chip>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : fetchError ? (
        <Card>
          <CardBody className="py-12 text-center">
            <AlertTriangle size={40} className="mx-auto text-danger mb-3" />
            <p className="text-default-500">{fetchError}</p>
            <Button size="sm" className="mt-4" onPress={fetchReviews}>
              Retry
            </Button>
          </CardBody>
        </Card>
      ) : reviews.length === 0 ? (
        <Card>
          <CardBody className="py-16 text-center">
            <MessageSquareQuote size={48} className="mx-auto text-default-300 mb-3" />
            <p className="text-default-500 mb-4">No teacher reviews yet.</p>
            <Button color="primary" startContent={<Plus size={16} />} onPress={openAdd}>
              Add First Review
            </Button>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <AnimatePresence>
            {reviews.map((review) => (
              <motion.div
                key={review._id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <ReviewCard
                  review={review}
                  onEdit={openEdit}
                  onDelete={handleDeleteClick}
                  onToggleVisibility={toggleVisibility}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Floating Add Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Tooltip content="Add Review" placement="left" color="primary">
          <Button
            color="primary"
            onPress={openAdd}
            isIconOnly
            radius="full"
            size="lg"
            className="shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:scale-105 transition-all"
          >
            <Plus size={20} />
          </Button>
        </Tooltip>
      </div>

      {/* Add / Edit Modal */}
      <Modal isOpen={isFormOpen} onClose={closeForm} size="lg" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader className="flex items-center gap-2">
            <MessageSquareQuote size={20} className="text-primary" />
            {editTarget ? "Edit Review" : "Add Teacher Review"}
          </ModalHeader>
          <ModalBody className="gap-4">
            <Input
              label="Teacher Name"
              placeholder="e.g. Rahul Sharma"
              value={form.name}
              onValueChange={(v) => {
                setForm((p) => ({ ...p, name: v }));
                setFormErrors((e) => { const n = { ...e }; delete n.name; return n; });
              }}
              isRequired
              variant="bordered"
              isInvalid={!!formErrors.name}
              errorMessage={formErrors.name}
            />
            <div className="flex gap-3">
              <Input
                label="Qualification"
                placeholder="e.g. M.Sc. Mathematics"
                value={form.qualification}
                onValueChange={(v) => {
                  setForm((p) => ({ ...p, qualification: v }));
                  setFormErrors((e) => { const n = { ...e }; delete n.qualification; return n; });
                }}
                isRequired
                variant="bordered"
                className="flex-1"
                isInvalid={!!formErrors.qualification}
                errorMessage={formErrors.qualification}
              />
              <Input
                label="Experience (Years)"
                placeholder="e.g. 12"
                type="number"
                value={form.experience}
                onValueChange={(v) => {
                  setForm((p) => ({ ...p, experience: v }));
                  setFormErrors((e) => { const n = { ...e }; delete n.experience; return n; });
                }}
                isRequired
                variant="bordered"
                className="w-1/3"
                isInvalid={!!formErrors.experience}
                errorMessage={formErrors.experience}
              />
            </div>
            <Textarea
              label="Review Message"
              placeholder="Teaching is about inspiring students..."
              value={form.message}
              onValueChange={(v) => {
                setForm((p) => ({ ...p, message: v }));
                setFormErrors((e) => { const n = { ...e }; delete n.message; return n; });
              }}
              isRequired
              variant="bordered"
              isInvalid={!!formErrors.message}
              errorMessage={formErrors.message}
              minRows={3}
              maxRows={6}
            />
            <div className="flex gap-3 items-center">
              <Input
                label="Display Order"
                placeholder="0"
                type="number"
                value={form.order}
                onValueChange={(v) => setForm((p) => ({ ...p, order: v }))}
                variant="bordered"
                className="max-w-30"
                startContent={<GripVertical size={16} className="text-default-400" />}
              />
              <div className="flex items-center gap-2 mt-4">
                <Switch
                  isSelected={form.isVisible}
                  onValueChange={(v) => setForm((p) => ({ ...p, isVisible: v }))}
                  size="sm"
                  color="success"
                />
                <span className="text-sm text-default-600">
                  {form.isVisible ? "Visible on homepage" : "Hidden from homepage"}
                </span>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={closeForm} isDisabled={isSaving}>Cancel</Button>
            <Button color="primary" onPress={handleSave} isLoading={isSaving}>
              {editTarget ? "Save Changes" : "Add Review"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={isDeleteOpen} onClose={closeDelete}>
        <ModalContent>
          <ModalHeader className="flex items-center gap-2">
            <AlertTriangle size={20} className="text-danger" />
            Delete Review
          </ModalHeader>
          <ModalBody>
            <p className="text-default-600">
              Are you sure you want to permanently remove this review?
            </p>
            {deleteTarget && (
              <div className="mt-3 p-3 rounded-lg bg-danger-50/40 border border-danger/20">
                <p className="font-semibold">{deleteTarget.name}</p>
                <p className="text-sm text-default-600 italic mt-1">"{deleteTarget.message}"</p>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={closeDelete} isDisabled={isDeleting}>Cancel</Button>
            <Button color="danger" onPress={confirmDelete} isLoading={isDeleting}>Delete</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

function ReviewCard({
  review,
  onEdit,
  onDelete,
  onToggleVisibility,
}: {
  review: TeacherReview;
  onEdit: (r: TeacherReview) => void;
  onDelete: (r: TeacherReview) => void;
  onToggleVisibility: (r: TeacherReview) => void;
}) {
  return (
    <Card className={`border transition-all ${review.isVisible ? "border-divider/50 hover:shadow-md" : "border-divider/30 opacity-60 hover:opacity-80"}`}>
      <CardHeader className="pb-1">
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-2 justify-between">
            <p className="text-base font-semibold text-default-900 truncate">
              {review.name}
            </p>
            <Chip size="sm" color={review.isVisible ? "success" : "default"} variant="dot" classNames={{ content: "text-xs" }}>
              {review.isVisible ? "Visible" : "Hidden"}
            </Chip>
          </div>
          <p className="text-xs text-default-500 truncate">
            {review.qualification} • {review.experience} Years Exp.
          </p>
        </div>
      </CardHeader>
      <CardBody className="pt-2 pb-2">
        <p className="text-sm italic text-default-600 leading-relaxed line-clamp-3">
          "{review.message}"
        </p>
      </CardBody>
      <CardFooter className="gap-2 pt-0">
        <Tooltip content={review.isVisible ? "Hide from homepage" : "Show on homepage"}>
          <Button size="sm" variant="flat" color={review.isVisible ? "default" : "success"} isIconOnly onPress={() => onToggleVisibility(review)}>
            {review.isVisible ? <EyeOff size={14} /> : <Eye size={14} />}
          </Button>
        </Tooltip>
        <Button size="sm" variant="flat" color="primary" startContent={<Pencil size={14} />} onPress={() => onEdit(review)} className="flex-1">
          Edit
        </Button>
        <Tooltip content="Delete review" color="danger">
          <Button size="sm" variant="flat" color="danger" isIconOnly onPress={() => onDelete(review)}>
            <Trash2 size={14} />
          </Button>
        </Tooltip>
      </CardFooter>
    </Card>
  );
}
