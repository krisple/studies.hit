package il.ac.hit.xpool;

import java.util.PriorityQueue;

/**
 * A pool of worker threads that manages task execution based on priority.
 * It distributes submitted tasks among a fixed number of pre-allocated threads.
 */
public class ThreadsPool {

    /**
     * The shared priority queue for storing submitted tasks.
     */
    private PriorityQueue<Task> tasksQueue;

    /**
     * Primary constructor for ThreadsPool.
     * Initializes the specified number of worker threads and starts them.
     * 
     * @param numberOfThreads The exact number of threads the pool will manage.
     */
    public ThreadsPool(int numberOfThreads) {
        super();

        // initializing the task queue with priority-based ordering via setter
        setTasksQueue(new PriorityQueue<>(new TaskComparator()));

        // validating and initializing workers
        initializePool(numberOfThreads);
    }

    /**
     * Sets the tasks queue for the pool.
     * * @param tasksQueue The priority queue to be assigned.
     */
    private void setTasksQueue(PriorityQueue<Task> tasksQueue) {
        this.tasksQueue = tasksQueue;
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

        for (int i = 0; i < count; i++) {
            WorkerThread worker = new WorkerThread(tasksQueue);
            worker.setName("xpool-worker-" + i);
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

        // safely adding the task to the queue and notifying a waiting worker
        synchronized (tasksQueue) {
            tasksQueue.add(task);
            tasksQueue.notify();
        }
    }
}
