import il.ac.hit.xpool.Task;
import il.ac.hit.xpool.ThreadsPool;
import java.util.Random;

public class XpoolExtremeStressTest {

    public static void main(String[] args) {
        System.out.println("=== Starting Extreme Stress Test ===");

        long startTime = System.currentTimeMillis();

        int numberOfThreads = 50;  // מלא טרדים
        int numberOfTasks = 2000;  // מלא משימות

        System.out.println("Initializing ThreadsPool with " + numberOfThreads + " threads...");
        ThreadsPool pool = new ThreadsPool(numberOfThreads);
        Random random = new Random();

        System.out.println("Submitting " + numberOfTasks + " tasks with random priorities (including negative)...");

        for (int i = 1; i <= numberOfTasks; i++) {
            // הגרלת עדיפות בין מינוס 20 לפלוס 20
            int randomPriority = random.nextInt(41) - 20;
            pool.submit(new SimpleTask(randomPriority, "ExtremeTask #" + i + " [Pri: " + randomPriority + "]"));
        }

        long submissionTime = System.currentTimeMillis();
        System.out.println("---");
        System.out.println("All " + numberOfTasks + " tasks submitted in " + (submissionTime - startTime) + " ms.");
        System.out.println("Workers are currently processing the queue...");
        System.out.println("Check your console to verify that the negative priorities (-20, -19...) print last!");

        // הערה: זמן הסיום האמיתי תלוי במה SimpleTask עושה.
        // אם SimpleTask עושה Thread.sleep(1000), אז 2000 משימות על 50 טרדים יקחו בדיוק 40 שניות.
        // שזה יופי של עמידה ביעד של "בגג דקה".
    }
}