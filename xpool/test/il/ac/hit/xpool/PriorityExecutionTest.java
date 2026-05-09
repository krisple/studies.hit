package il.ac.hit.xpool;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Verifies priority-based execution order using JUnit 5.
 */
public class PriorityExecutionTest {

    @Test
    public void testExecutionOrderById() throws InterruptedException {
        ThreadsPool pool = new ThreadsPool(1);
        final List<Integer> executionOrder = new ArrayList<>();

        // 1. Clog the pool with a slow low-priority task
        pool.submit(new SimpleTask(-1) {
            @Override
            public void perform() {
                try {
                    Thread.sleep(300);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }
        });

        // 2. Submit tasks with different priorities
        pool.submit(new SimpleTask(5) {
            @Override
            public void perform() {
                synchronized (executionOrder) {
                    executionOrder.add(5);
                }
            }
        });
        pool.submit(new SimpleTask(10) {
            @Override
            public void perform() {
                synchronized (executionOrder) {
                    executionOrder.add(10);
                }
            }
        });
        pool.submit(new SimpleTask(1) {
            @Override
            public void perform() {
                synchronized (executionOrder) {
                    executionOrder.add(1);
                }
            }
        });

        // 3. Wait for completion
        Thread.sleep(1000);

        synchronized (executionOrder) {
            List<Integer> expected = Arrays.asList(10, 5, 1);
            Assertions.assertEquals(expected, executionOrder, "Tasks were not executed in priority order");
        }
    }
}
