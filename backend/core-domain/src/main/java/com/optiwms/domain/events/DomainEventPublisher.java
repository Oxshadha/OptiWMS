package com.optiwms.domain.events;

public interface DomainEventPublisher {
    void publish(Object event);
}


