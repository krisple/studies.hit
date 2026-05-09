package il.ac.hit.xpool;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

/**
 * Verifies non-preemption of running tasks using JUnit 5.
 */
public class NonPreemptionTest {

    private boolean taskInterrupted = false;

    @Test
    public void testNonPreemption() throws InterruptedException {
        ThreadsPool pool = new ThreadsPool(1);

        pool.submit(new SimpleTask(1) {
            @Override
            public void perform() {
                try {
                    Thread.sleep(800);
                } catch (InterruptedException e) {
                    taskInterrupted = true;
                }
            }
        });

        // Submit high-priority task while the first is running
        Thread.sleep(200);
        pool.submit(new SimpleTask(1000));

        Thread.sleep(1000);

        Assertions.assertFalse(taskInterrupted,
                "The running task was prematurely interrupted by a higher priority task");
    }
}
