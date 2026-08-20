package com.optiwms.coreapi.config;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.NonNull;
import org.springframework.web.context.request.WebRequest;

import java.time.Duration;
import java.util.Arrays;

public final class ReferenceDataCacheSupport {

    private static final CacheControl CACHE_CONTROL = CacheControl
            .maxAge(Duration.ofMinutes(10))
            .cachePrivate()
            .mustRevalidate();

    private ReferenceDataCacheSupport() {
    }

    @SuppressWarnings("null")
    public static <T> ResponseEntity<T> ok(@NonNull WebRequest request, T body, Object... cacheKeyParts) {
        String eTag = buildEtag(cacheKeyParts);
        if (request.checkNotModified(eTag)) {
            return ResponseEntity.status(HttpStatus.NOT_MODIFIED)
                    .cacheControl(CACHE_CONTROL)
                    .eTag(eTag)
                    .build();
        }

        return ResponseEntity.ok()
                .cacheControl(CACHE_CONTROL)
                .eTag(eTag)
                .body(body);
    }

    private static String buildEtag(Object... cacheKeyParts) {
        int hash = Arrays.deepHashCode(cacheKeyParts);
        return "ref-" + Integer.toHexString(hash);
    }
}
