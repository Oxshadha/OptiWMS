package com.optiwms.domain.tasks;

import com.optiwms.domain.common.BaseEntity;

public class Task extends BaseEntity {
    public enum TaskType {
        PICK, PUTAWAY, COUNT, MOVE
    }

    public enum TaskStatus {
        PENDING, IN_PROGRESS, COMPLETED, EXCEPTION
    }

    private TaskType type;
    private TaskStatus status;
    private Long assigneeUserId;
    private String reference;

    public TaskType getType() {
        return type;
    }

    public void setType(TaskType type) {
        this.type = type;
    }

    public TaskStatus getStatus() {
        return status;
    }

    public void setStatus(TaskStatus status) {
        this.status = status;
    }

    public Long getAssigneeUserId() {
        return assigneeUserId;
    }

    public void setAssigneeUserId(Long assigneeUserId) {
        this.assigneeUserId = assigneeUserId;
    }

    public String getReference() {
        return reference;
    }

    public void setReference(String reference) {
        this.reference = reference;
    }
}


