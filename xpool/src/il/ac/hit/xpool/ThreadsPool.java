package il.ac.hit.xpool;

import java.util.ArrayList;
import java.util.List;
import java.util.PriorityQueue;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * A pool of worker threads that manages task execution based on priority.
 * It distributes submitted tasks among a fixed number of pre-allocated threads.
 */
public class ThreadsPool {

    /**
     * Logger for tracking pool initialization and task submission.
     */
    private static final Logger logger = Logger.getLogger(ThreadsPool.class.getName());

    /**
     * The shared priority queue for storing submitted tasks.
     */
    private final PriorityQueue<Task> tasksQueue;

    /**
     * The list of worker threads managed by this pool.
     */
    private final List<WorkerThread> workers;

    /**
     * Primary constructor for ThreadsPool.
     * Initializes the specified number of worker threads and starts them.
     * 
     * @param numberOfThreads The exact number of threads the pool will manage.
     */
    public ThreadsPool(int numberOfThreads) {
        super();

        // initializing the task queue with priority-based ordering
        this.tasksQueue = new PriorityQueue<>(new TaskComparator());
        this.workers = new ArrayList<>();

        // validating and initializing workers
        initializePool(numberOfThreads);
    }

    /**
     * Initializes the worker threads and starts them.
     * 
     * @param count The number of threads to create.
     */
    private void initializePool(int count) {
        if (count <= 0) {
            throw new XPoolException("Number of threads must be greater than zero");
        }

        logger.log(Level.INFO, "Initializing pool with {0} threads", count);

        for (int i = 0; i < count; i++) {
            WorkerThread worker = new WorkerThread(tasksQueue);
            worker.setName("xpool-worker-" + i);

            workers.add(worker);
            worker.start();
        }
    }

    /**
     * Submits a new task to the pool for execution.
     * Tasks are executed based on their priority level.
     * 
     * @param task The unit of work to be performed.
     */
    public void submit(Task task) {
        // validating the task
        if (task == null) {
            throw new XPoolException("Cannot submit a null task");
        }

        // logger.log(Level.INFO, "New task submitted with priority: {0}", task.getPriority());

        // safely adding the task to the queue and notifying a waiting worker
        synchronized (tasksQueue) {
            tasksQueue.add(task);
            logger.log(
                    Level.INFO,
                    "SUBMITTED task with priority {0}. Queue size after submit: {1}",
                    new Object[] { task.getPriority(), tasksQueue.size() });
            tasksQueue.notify();
        }
    }
}
