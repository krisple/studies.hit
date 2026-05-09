package il.ac.hit.xpool;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import java.util.ArrayList;
import java.util.List;

/**
 * High-load concurrency test using JUnit 5.
 */
public class ConcurrencyLoadTest {

    @Test
    public void testMassiveTaskSubmission() throws InterruptedException {
        final int submittersCount = 10;
        final int tasksPerSubmitter = 100;
        final ThreadsPool pool = new ThreadsPool(4);
        final List<Integer> completionList = new ArrayList<>();
        List<Thread> submitterThreads = new ArrayList<>();

        for (int i = 0; i < submittersCount; i++) {
            Thread t = new Thread(() -> {
                for (int j = 0; j < tasksPerSubmitter; j++) {
                    pool.submit(new SimpleTask((int) (Math.random() * 100)) {
                        @Override
                        public void perform() {
                            synchronized (completionList) {
                                completionList.add(1);
                            }
                        }
                    });
                }
            });
            submitterThreads.add(t);
            t.start();
        }

        for (Thread t : submitterThreads)
            t.join();

        // Wait for workers to drain the queue
        Thread.sleep(2000);

        int expectedTotal = submittersCount * tasksPerSubmitter;
        synchronized (completionList) {
            Assertions.assertEquals(expectedTotal, completionList.size(), "Not all submitted tasks were completed");
        }
    }
}
