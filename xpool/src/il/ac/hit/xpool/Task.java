package il.ac.hit.xpool;

/**
 * Represents a unit of work that can be submitted to a thread pool.
 * Each task has an associated priority level that determines its execution order.
 */
public interface Task {

    /**
     * Performs the logic associated with the task.
     * This method is called by a worker thread in the pool.
     */
    public abstract void perform();

    /**
     * Sets the priority level for this task.
     * 
     * @param level An integer representing the priority level. 
     *              Higher values indicate higher importance.
     */
    public abstract void setPriority(int level);

    /**
     * Retrieves the current priority level of the task.
     * 
     * @return The priority level as an integer.
     */
    public abstract int getPriority();
}
