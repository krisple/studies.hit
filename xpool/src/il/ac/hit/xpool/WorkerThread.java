package il.ac.hit.xpool;

import java.util.Queue;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * A worker thread that consumes and executes tasks from a shared priority
 * queue.
 * The thread waits when the queue is empty and processes tasks one by one.
 */
public class WorkerThread extends Thread {

    /**
     * Logger for tracking worker thread lifecycle and execution.
     */
    private static final Logger logger = Logger.getLogger(WorkerThread.class.getName());

    /**
     * The shared queue from which tasks are retrieved.
     */
    private final Queue<Task> tasksQueue;

    /**
     * Primary constructor for WorkerThread.
     * 
     * @param queue The shared tasks queue to monitor and consume from.
     */
    public WorkerThread(Queue<Task> queue) {
        super();

        // Validating and assigning final tasksQueue field
        if (queue == null) {
            throw new XPoolException("Tasks queue cannot be null");
        }
        this.tasksQueue = queue;
    }

    /**
     * The main execution loop of the worker thread.
     * Continuously pulls tasks from the queue and performs them.
     */
    @Override
    public void run() {
        logger.log(Level.INFO, "Worker thread {0} started", getName());

        while (true) {
            Task taskToExecute = null;

            // acquiring the lock to safely retrieve the next task
            synchronized (tasksQueue) {
                while (tasksQueue.isEmpty()) {
                    try {
                        // waiting for a notification that a new task has arrived
                        tasksQueue.wait();
                    } catch (InterruptedException e) {
                        logger.log(Level.SEVERE, "Worker thread interrupted while waiting", e);
                        // restoring interrupted status and exiting loop if necessary
                        Thread.currentThread().interrupt();
                        return;
                    }
                }

                // extracting the highest priority task
                taskToExecute = tasksQueue.poll();
                if (taskToExecute != null) {
                    logger.log(
                            Level.INFO,
                            "Worker {0} POLLED task with priority {1}. Queue size after poll: {2}",
                            new Object[] { getName(), taskToExecute.getPriority(), tasksQueue.size() });
                }
            }

            // executing the task outside the synchronized block to avoid blocking the queue
            if (taskToExecute != null) {
                performTask(taskToExecute);
            }
        }
    }

    /**
     * Executes the given task and handles any potential runtime errors.
     * 
     * @param task The task to be performed.
     */
    private void performTask(Task task) {
        try {
            logger.log(Level.FINER, "Worker {0} starting task execution", getName());
            task.perform();
            logger.log(Level.FINER, "Worker {0} finished task execution", getName());
        } catch (RuntimeException e) {
            logger.log(Level.SEVERE, "Exception occurred during task execution in worker " + getName(), e);
            // wrapping and logging is sufficient as we want the worker thread to survive
        }
    }
}
