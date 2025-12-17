package com.optiwms.coreapp.events;

public interface DomainEventPublisher {
    void publish(Object event);
}


