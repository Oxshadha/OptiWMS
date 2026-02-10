package com.optiwms.domain.sops;

import com.optiwms.domain.common.BaseEntity;

import java.util.List;

public class Sop extends BaseEntity {
    private String title;
    private String category;
    private String content;
    private String version;
    private String status;
    private String createdBy;
    private List<String> applicableRoles;

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getVersion() {
        return version;
    }

    public void setVersion(String version) {
        this.version = version;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(String createdBy) {
        this.createdBy = createdBy;
    }

    public List<String> getApplicableRoles() {
        return applicableRoles;
    }

    public void setApplicableRoles(List<String> applicableRoles) {
        this.applicableRoles = applicableRoles;
    }
}
