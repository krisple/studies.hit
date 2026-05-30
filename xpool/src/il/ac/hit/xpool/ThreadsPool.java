package il.ac.hit.xpool;

import java.util.PriorityQueue;
import java.util.Queue;

/**
 * A pool of worker threads that manages task execution based on priority.
 * It distributes submitted tasks among a fixed number of pre-allocated threads.
 */
public class ThreadsPool {

    /**
     * The shared priority-based queue for storing submitted tasks.
     */
    private Queue<Task> tasks;

    /**
     * Primary constructor for ThreadsPool.
     * Initializes the specified number of worker threads and starts them.
     * 
     * @param numberOfThreads The exact number of threads the pool will manage.
     */
    public ThreadsPool(int numberOfThreads) {
        super();

        // PriorityQueue is utilized to ensure tasks are processed dynamically by
        // descending priority.
        setTasks(new PriorityQueue<>(new TaskComparator()));

        // Worker threads are initialized and started immediately to prepare the pool
        // for execution.
        initializePool(numberOfThreads);
    }

    /**
     * Submits a new task to the pool for execution.
     * Tasks are executed based on their priority level.
     * 
     * @param task The unit of work to be performed.
     * @throws XPoolException if the task is null.
     */
    public void submit(Task task) {
        if (task == null) {
            throw new XPoolException("Cannot submit a null task");
        }

        // Synchronize queue access before adding a task and notifying a worker.
        synchronized (tasks) {
            tasks.add(task);
            tasks.notify();
        }
    }

    /**
     * Returns a string representation of this threads pool.
     * 
     * @return A string representation of the threads pool.
     */
    @Override
    public String toString() {
        return "ThreadsPool{tasks=" + tasks + "}";
    }

    /**
     * Initializes the worker threads and starts them.
     * 
     * @param count The number of threads to create.
     * @throws XPoolException if the thread count is less than or equal to zero.
     */
    private void initializePool(int count) {
        if (count <= 0) {
            throw new XPoolException("Number of threads must be greater than zero");
        }

        // Create and start the worker threads.
        for (int i = 0; i < count; i++) {
            WorkerThread worker = new WorkerThread(tasks);
            worker.setName("xpool-worker-" + i);
            worker.start();
        }
    }

    /**
     * Sets the tasks queue for the pool.
     * 
     * @param tasks The priority queue to be assigned.
     * @throws XPoolException if the tasks queue is null.
     */
    private void setTasks(Queue<Task> tasks) {
        if (tasks == null) {
            throw new XPoolException("Tasks queue cannot be null");
        }
        this.tasks = tasks;
    }
}
